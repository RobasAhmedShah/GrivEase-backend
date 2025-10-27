import { onRequest } from 'firebase-functions/v2/https';
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import cors from "cors";
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import {Readable} from 'stream'
import * as mimeTypes from 'mime-types';


// Initialize Firebase Admin SDK
admin.initializeApp();
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWLIO_AUTH_TOKEN;

// Initialize Firebase Auth
const auth = admin.auth();

// Initialize Firestore
const db = admin.firestore();

// Initialize CORS middleware
const corsHandler = cors({
  origin: true,
});

// Sign Up (Register a new user)
export const signUp = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).send("Invalid request: 'email' and 'password' are required.");
      return;
    }

    try {
      // Create a new user with Firebase Authentication
      const userRecord = await auth.createUser({
        email,
        password,
      });

      res.status(201).send({
        message: "User created successfully",
        uid: userRecord.uid,
      });
    } catch (error) {
      console.error("Error signing up:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});

// Sign In (Authenticate user and return a custom token)
export const signIn = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).send("Invalid request: 'email' and 'password' are required.");
      return;
    }

    try {
      // Sign in the user using Firebase Admin SDK (using email and password is not possible directly with admin SDK)
      // Here, we will issue a custom token instead of using `signInWithEmailAndPassword`
      const user = await admin.auth().getUserByEmail(email);

      // Issue a custom token that can be used by the frontend to authenticate with Firebase
      const customToken = await admin.auth().createCustomToken(user.uid);

      res.status(200).send({
        message: "User signed in successfully",
        customToken,
      });
    } catch (error) {
      console.error("Error signing in:", error);
      res.status(401).send(error instanceof Error ? error.message : "Invalid credentials");
    }
  });
});

// Add a New Grievance
// Hardcode your Gemini API key here (not recommended in production)
const GEMINI_API_KEY = process.env.GEMINI_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=" + GEMINI_API_KEY;

export const addGrievance = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const {
      title,
      description,
      department,
      anonymity,
      contactNumber,
    } = req.body;

    if (!title || !description || !department || anonymity === undefined || !contactNumber) {
      res.status(400).send("Invalid request: Required fields are missing.");
      return;
    }
    
      // Normalize the contact number
    let normalizedContactNumber = contactNumber; // Create a mutable copy
    
      // If it starts with 'whatsapp:' remove it
    if (normalizedContactNumber.startsWith('whatsapp:')) {
      normalizedContactNumber = normalizedContactNumber.substring('whatsapp:'.length);
      }
  
      // If it starts with '+' remove it
    if (normalizedContactNumber.startsWith('+')) {
      normalizedContactNumber = normalizedContactNumber.substring(1);
      }

    try {
      const promptText = `
You are a system that decides the priority, grievance type, and category of a given grievance based on its title and description.

Priority: One of ["Low", "Medium", "High"].
GrievanceType: A single word (e.g., "Service", "Technical", "Billing", "Health", "Infrastructure").
Category: A single word (e.g., "Network", "Payment", "HR", "Maintenance").

Title: ${title}
Description: ${description}

Respond with a single JSON object in this exact format (no extra text):
{
  "priority": "Low|Medium|High",
  "grievanceType": "<SingleWord>",
  "category": "<SingleWord>"
}
`.trim();

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: promptText
              }
            ]
          }
        ]
      };

      const geminiResponse = await axios.post(GEMINI_ENDPOINT, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
      });

      const candidates = geminiResponse.data?.candidates;
      let finalPriority = "Medium";
      let finalGrievanceType = "General";
      let finalCategory = "General";

      if (Array.isArray(candidates) && candidates.length > 0) {
        const rawText = candidates[0]?.content?.parts?.[0]?.text?.trim();
        if (rawText) {
          try {
            const jsonText = rawText.replace(/```json\n([\s\S]*?)\n```/, '$1').trim();
            const parsed = JSON.parse(jsonText);

            const validPriorities = ["Low", "Medium", "High"];
            if (parsed.priority && validPriorities.includes(parsed.priority)) {
              finalPriority = parsed.priority;
            }

            if (parsed.grievanceType && typeof parsed.grievanceType === 'string') {
              finalGrievanceType = parsed.grievanceType;
            }

            if (parsed.category && typeof parsed.category === 'string') {
              finalCategory = parsed.category;
            }
          } catch (e) {
            console.error("Error parsing JSON from model:", e);
          }
        }
      }

      const grievanceDocId = normalizedContactNumber; 
      const newGrievance = {
        contactNumber: normalizedContactNumber, 
        title,
        description,
        department,
        priority: finalPriority,
        grievanceType: finalGrievanceType,
        anonymity,
        category: finalCategory,
        status: "New",
        resolved: false,
        createdAt: admin.firestore.Timestamp.now(),
        resolvedAt: null,
      };

      const grievanceDoc = db.collection("grievances").doc(grievanceDocId);
      const docSnapshot = await grievanceDoc.get();

      if (docSnapshot.exists) {
        res.status(400).send("A grievance with this contact number already exists.");
        return;
      }

      await grievanceDoc.set(newGrievance);

      res.status(201).send({
        id: grievanceDocId,
        priority: finalPriority,
        grievanceType: finalGrievanceType,
        category: finalCategory,
        message: "Grievance added successfully with Gemini-determined fields"
      });
    } catch (error) {
      console.error("Error adding grievance:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});

// Fetch All Grievances
export const fetchAllGrievances = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    try {
      const grievancesQuery = db.collection("grievances");
      const querySnapshot = await grievancesQuery.get();

      if (querySnapshot.empty) {
        res.status(404).send("No grievances found");
        return;
      }

      const grievancesData = querySnapshot.docs.map((doc: { id: any; data: () => any; }) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.status(200).json(grievancesData);
    } catch (error) {
      console.error("Error fetching grievances:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});

// Fetch Grievance by ID
export const fetchGrievanceById = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { grievanceId } = req.query;

    // Validate request
    if (!grievanceId || typeof grievanceId !== "string") {
      res.status(400).send("Invalid request: 'grievanceId' is required and must be a string.");
      return;
    }

    try {
      const grievanceDoc = db.collection("grievances").doc(grievanceId);
      const docSnapshot = await grievanceDoc.get();

      if (!docSnapshot.exists) {
        res.status(404).send("Grievance not found");
        return;
      }

      const grievanceData = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      };

      res.status(200).json(grievanceData);
    } catch (error) {
      console.error("Error fetching grievance:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});

// Update Grievance Status
export const updateGrievanceStatus = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { grievanceId, status } = req.body;

    // Validate request
    const validStatuses = ["New", "Open", "In-Progress", "Resolved", "Completed"];
    if (!grievanceId || typeof grievanceId !== "string" || !status || !validStatuses.includes(status)) {
      res.status(400).send("Invalid request: 'grievanceId' and 'status' are required and status must be valid.");
      return;
    }

    try {
      const grievanceDoc = db.collection("grievances").doc(grievanceId);
      const docSnapshot = await grievanceDoc.get();

      if (!docSnapshot.exists) {
        console.error(`Grievance with ID ${grievanceId} not found`);
        res.status(404).send("Grievance not found");
        return;
      }

      await grievanceDoc.update({
        status,
        ...(status === "Resolved" && {
          resolved: true,
          resolvedAt: admin.firestore.Timestamp.now(),
        }),
      });

      res.status(200).send("Grievance status updated successfully");
    } catch (error) {
      console.error("Error updating grievance status:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});



export const getAnalytics = onRequest(async (req: Request, res: Response) => {
  corsHandler(req, res, async () => {
  try {
    // Initialize breakdown objects
    let statusBreakdown = {
      reported: 0,
      open: 0,
      inProgress: 0,
      completed: 0
    };
    
    let grievanceTypeBreakdown: { [key: string]: { resolved: number; pending: number } } = {};
    let anonymityBreakdown = { anonymous: 0, nonAnonymous: 0 };
    let priorityRatings: { [key: string]: { low: number; medium: number; high: number } } = {};
    let departmentGrievanceBreakdown: { [key: string]: { total: number; resolved: number; pending: number } } = {};
    const responseTimes: { [key: string]: number[] } = {}; // Store response times for each department
    let totalGrievances = 0;

    const grievancesSnapshot = await db.collection("grievances").get();

    grievancesSnapshot.forEach((doc: { data: () => any; }) => {
      const grievance = doc.data();
      totalGrievances++;

      // 1. Status Breakdown
      if (grievance.status) {
        if (grievance.status === "New") statusBreakdown.reported++;
        if (grievance.status === "Open") statusBreakdown.open++;
        if (grievance.status === "In-Progress") statusBreakdown.inProgress++;
        if (grievance.status === "Resolved") statusBreakdown.completed++;
      }

      // 2. Grievance Type Breakdown
      const grievanceType = grievance.grievanceType || "Unknown";
      if (!grievanceTypeBreakdown[grievanceType]) {
        grievanceTypeBreakdown[grievanceType] = { resolved: 0, pending: 0 };
      }
      if (grievance.status === "Completed") {
        grievanceTypeBreakdown[grievanceType].resolved++;
      } else {
        grievanceTypeBreakdown[grievanceType].pending++;
      }

      // 3. Anonymity Breakdown
      if (grievance.anonymity) {
        anonymityBreakdown.anonymous++;
      } else {
        anonymityBreakdown.nonAnonymous++;
      }

      // 4. Priority Ratings
      const priority = grievance.priority || "Unknown";
      const department = grievance.department || "Unknown";
      if (!priorityRatings[department]) {
        priorityRatings[department] = { low: 0, medium: 0, high: 0 };
      }
      if (priority === "Low") priorityRatings[department].low++;
      if (priority === "Medium") priorityRatings[department].medium++;
      if (priority === "High") priorityRatings[department].high++;

      // 5. Department Grievance Breakdown
      if (!departmentGrievanceBreakdown[department]) {
        departmentGrievanceBreakdown[department] = { total: 0, resolved: 0, pending: 0 };
      }
      departmentGrievanceBreakdown[department].total++;
      if (grievance.status === "Resolved") {
        departmentGrievanceBreakdown[department].resolved++;
      } else {
        departmentGrievanceBreakdown[department].pending++;
      }

      // 6. Response Time Calculation
      if (grievance.resolvedAt && grievance.createdAt) {
        const createdAt = grievance.createdAt.toDate();
        const resolvedAt = grievance.resolvedAt.toDate();
        const responseTime = (resolvedAt.getTime() - createdAt.getTime()) / 1000; // in seconds
        if (!responseTimes[department]) {
          responseTimes[department] = [];
        }
        responseTimes[department].push(responseTime);
      }
    });

    // Calculate average response times for each department
    const avgResponseTimes: { [key: string]: number } = Object.keys(responseTimes).reduce((acc: { [key: string]: number }, department) => {
      const totalResponseTime = responseTimes[department].reduce((sum, time) => sum + time, 0);
      const avgTime = totalResponseTime / responseTimes[department].length;
      acc[department] = avgTime;
      return acc;
    }, {});

    // Calculate Closure Rate (completed grievances / total grievances)
    const closureRate = {
      month: new Date().getMonth() + 1, // Current month
      closureRate: totalGrievances > 0 ? statusBreakdown.completed / totalGrievances : 0
    };

    // Prepare analytics response
    const analyticsData = {
      statusBreakdown,
      grievanceTypeBreakdown,
      anonymityBreakdown,
      closureRate,
      avgResponseTimes,
      priorityRatings,
      departmentGrievanceBreakdown
    };

    // Send the response with analytics data
    res.status(200).json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
  }
  });
});

// Send WhatsApp Message (API endpoint)
export const sendWhatsAppMessage = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { to, body, from, mediaUrls } = req.body;

    // Validate request body
    if (!to || !body || !from) {
      res.status(400).send("Invalid request: 'to', 'body', and 'from' are required.");
      return;
    }

    try {
      await admin.firestore().collection('messages').add({
        to,
        body,
        from,
        mediaUrls: mediaUrls || [], // Optional media
      });

      res.status(200).send('Message queued for delivery via WhatsApp!');
    } catch (error) {
      console.error("Error queuing WhatsApp message:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});

export const uploadTwilioMediaToStorage = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    const { contactNumber, mediaUrl } = req.body;

    if (!mediaUrl) {
      res.status(400).send('Media URL is required');
      return;
    }

    if (!contactNumber) {
      res.status(400).send('Contact number is required');
      return;
    }

    try {
      const auth = {
        username: TWILIO_ACCOUNT_SID ?? '',
        password: TWILIO_AUTH_TOKEN ?? '',
      };

      const sanitizedNumber = contactNumber.replace(/^whatsapp:\+/, '');
      const response = await axios.get(mediaUrl, {
        responseType: 'stream',
        auth,
      });

      const contentType = response.headers['content-type'] || 'application/octet-stream';
      // Use mime-types to get the extension
      const extension = mimeTypes.extension(contentType) || 'bin';

      const fileName = `${sanitizedNumber}.${extension}`;
      const filePath = path.join(os.tmpdir(), fileName);

      const writer = fs.createWriteStream(filePath);
      const readableStream = response.data as Readable;
      readableStream.pipe(writer);

      writer.on('finish', async () => {
        try {
          const bucket = admin.storage().bucket();
          await bucket.upload(filePath, {
            destination: `twilio_media/${fileName}`,
            metadata: {
              contentType,
            },
            predefinedAcl: 'publicRead',
          });

          const publicUrl = `https://storage.googleapis.com/${bucket.name}/twilio_media/${encodeURIComponent(fileName)}`;
          fs.unlinkSync(filePath);

          res.status(200).send({ message: 'File uploaded successfully', fileUrl: publicUrl });
        } catch (error) {
          console.error('Error uploading media to Firebase Storage:', error);
          res.status(500).send('Error uploading media to Firebase Storage');
        }
      });

      writer.on('error', (error) => {
        console.error('Error writing file:', error);
        res.status(500).send('Error writing media file');
      });

    } catch (error) {
      console.error('Error downloading media:', error);
      res.status(500).send('Error downloading media from Twilio');
    }
  });
});
  
//Get media from storage
export const getTwilioMediaFromStorage = onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
      const { contactNumber,extension } = req.query;
  
      if (!contactNumber) {
        res.status(400).send("Contact number is required");
        return;
      }
      if(!extension)
        {
          res.status(400).send("Extension is Required");
          return;
        }
  
      try {
        const bucket = admin.storage().bucket();
        const fileName = `${contactNumber}.${extension}`;
        console.log(fileName);
        const file = bucket.file(`twilio_media/${fileName}`);
  
        // Check if the file exists
        const [exists] = await file.exists();
        if (!exists) {
          res.status(404).send("File not found");
          return;
        }
  
        // If the file is public, you can return its public URL directly:
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/twilio_media/${encodeURIComponent(fileName)}`;
        res.status(200).send({ fileUrl: publicUrl });
  
        // If you want to generate a signed URL instead (for private files):
        // const [url] = await file.getSignedUrl({
        //   action: 'read',
        //   expires: Date.now() + 1000 * 60 * 60, // 1 hour
        // });
        // res.status(200).send({ fileUrl: url });
  
      } catch (error) {
        console.error("Error retrieving file:", error);
        res.status(500).send("Error retrieving file from storage");
      }
    });
  });
