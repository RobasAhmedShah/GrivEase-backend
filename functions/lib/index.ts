import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import cors from "cors";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Initialize CORS middleware
const corsHandler = cors({
  origin: [
    "http://localhost:3000"
  ],
});

// Add a New Grievance
export const addGrievance = functions.https.onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { title, description, department, priority, contactNumber } = req.body;

    // Validate request body
    if (!title || !description || !department || !priority || !contactNumber) {
      res.status(400).send("Invalid request: All fields, including 'contactNumber', are required.");
      return;
    }

    try {
      const grievanceDocId = contactNumber; // Use contact number as doc ID

      const newGrievance = {
        title,
        description,
        department,
        priority,
        status: "New", // Default status
        date: admin.firestore.Timestamp.now(),
      };

      // Check if a grievance with the same contact number already exists
      const grievanceDoc = db.collection("grievances").doc(grievanceDocId);
      const docSnapshot = await grievanceDoc.get();

      if (docSnapshot.exists) {
        res.status(400).send("A grievance with this contact number already exists.");
        return;
      }

      // Set the document with the contact number as the doc ID
      await grievanceDoc.set(newGrievance);

      res.status(201).send({ id: grievanceDocId, message: "Grievance added successfully" });
    } catch (error) {
      console.error("Error adding grievance:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});


// Fetch All Grievances
export const fetchAllGrievances = functions.https.onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    try {
      const grievancesQuery = db.collection("grievances");
      const querySnapshot = await grievancesQuery.get();

      if (querySnapshot.empty) {
        res.status(404).send("No grievances found");
        return;
      }

      const grievancesData = querySnapshot.docs.map((doc) => ({
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
export const fetchGrievanceById = functions.https.onRequest((req: Request, res: Response) => {
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
export const updateGrievanceStatus = functions.https.onRequest((req: Request, res: Response) => {
  corsHandler(req, res, async () => {
    const { grievanceId, status } = req.body;

    // Validate request
    if (!grievanceId || typeof grievanceId !== "string" || !status || typeof status !== "string") {
      res.status(400).send("Invalid request: 'grievanceId' and 'status' are required.");
      return;
    }

    try {
      const grievanceDoc = db.collection("grievances").doc(grievanceId);
      const docSnapshot = await grievanceDoc.get();

      if (!docSnapshot.exists) {
        res.status(404).send("Grievance not found");
        return;
      }

      await grievanceDoc.update({
        status,
      });

      res.status(200).send("Grievance status updated successfully");
    } catch (error) {
      console.error("Error updating grievance status:", error);
      res.status(500).send(error instanceof Error ? error.message : "An unknown error occurred");
    }
  });
});
