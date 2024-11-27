# Grievance Management System API Documentation
**Bitsol Ventures**

*Author: Robas Ahmed Shah*  
*Position: Software Engineer*  
*Last Updated: November 27, 2024*

---

## Table of Contents
1. [Add a New Grievance](#1-add-a-new-grievance)
2. [Fetch All Grievances](#2-fetch-all-grievances)
3. [Fetch Grievance by ID](#3-fetch-grievance-by-id)
4. [Update Grievance Status](#4-update-grievance-status)
5. [Developer Notes](#developer-notes)

---

## 1. Add a New Grievance

Create a new grievance record in the system.

**Endpoint:** `POST /addGrievance`  
**Base URL:** `https://addgrievance-3j2km55l3q-uc.a.run.app`

### Request Parameters

| Parameter    | Type     | Required | Description                                    |
|-------------|----------|----------|------------------------------------------------|
| title       | string   | Yes      | The title or subject of the grievance          |
| description | string   | Yes      | A detailed description of the grievance        |
| department  | string   | Yes      | The department related to the grievance        |
| priority    | string   | Yes      | Priority level ("Low", "Medium", "High")       |

### Request Example

```json
{
    "title": "Issue with office equipment",
    "description": "The photocopier is not working properly.",
    "department": "IT",
    "priority": "High"
}
```

### Responses

#### Success Response (201 Created)
```json
{
    "id": "grievance-id-123",
    "message": "Grievance added successfully"
}
```

#### Error Responses

**400 Bad Request**
```json
{
    "message": "Invalid request: All fields are required."
}
```

**500 Internal Server Error**
```json
{
    "message": "An unknown error occurred"
}
```

---

## 2. Fetch All Grievances

Retrieve a list of all grievances in the system.

**Endpoint:** `GET /fetchAllGrievances`  
**Base URL:** `https://fetchallgrievances-3j2km55l3q-uc.a.run.app`

### Request Parameters
None required

### Responses

#### Success Response (200 OK)
```json
[
    {
        "id": "grievance-id-123",
        "title": "Issue with office equipment",
        "description": "The photocopier is not working properly.",
        "department": "IT",
        "priority": "High",
        "status": "New",
        "date": "2024-11-27T10:00:00Z"
    },
    {
        "id": "grievance-id-124",
        "title": "Electricity outage",
        "description": "Frequent power outages in the office.",
        "department": "Facilities",
        "priority": "Medium",
        "status": "In Progress",
        "date": "2024-11-26T09:00:00Z"
    }
]
```

#### Error Responses

**404 Not Found**
```json
{
    "message": "No grievances found"
}
```

**500 Internal Server Error**
```json
{
    "message": "An unknown error occurred"
}
```

---

## 3. Fetch Grievance by ID

Retrieve details of a specific grievance using its ID.

**Endpoint:** `GET /fetchGrievanceById`  
**Base URL:** `https://fetchgrievancebyid-3j2km55l3q-uc.a.run.app`

### Request Parameters

| Parameter   | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| grievanceId | string | Yes      | Unique identifier of grievance |

### Request Example
```
GET /fetchGrievanceById?grievanceId=grievance-id-123
```

### Responses

#### Success Response (200 OK)
```json
{
    "id": "grievance-id-123",
    "title": "Issue with office equipment",
    "description": "The photocopier is not working properly.",
    "department": "IT",
    "priority": "High",
    "status": "New",
    "date": "2024-11-27T10:00:00Z"
}
```

#### Error Responses

**400 Bad Request**
```json
{
    "message": "Invalid request: 'grievanceId' is required and must be a string."
}
```

**404 Not Found**
```json
{
    "message": "Grievance not found"
}
```

**500 Internal Server Error**
```json
{
    "message": "An unknown error occurred"
}
```

---

## 4. Update Grievance Status

Update the status of an existing grievance.

**Endpoint:** `PUT /updateGrievanceStatus`  
**Base URL:** `https://updategrievancestatus-3j2km55l3q-uc.a.run.app`

### Request Parameters

| Parameter   | Type   | Required | Description                                               |
|------------|--------|----------|-----------------------------------------------------------|
| grievanceId | string | Yes      | Unique identifier of grievance                           |
| status     | string | Yes      | New status ("In Progress", "Resolved", "Closed")         |

### Request Example
```json
{
    "grievanceId": "grievance-id-123",
    "status": "Resolved"
}
```

### Responses

#### Success Response (200 OK)
```json
{
    "message": "Grievance status updated successfully"
}
```

#### Error Responses

**400 Bad Request**
```json
{
    "message": "Invalid request: 'grievanceId' and 'status' are required."
}
```

**404 Not Found**
```json
{
    "message": "Grievance not found"
}
```

**500 Internal Server Error**
```json
{
    "message": "An unknown error occurred"
}
```

---

## Developer Notes

### CORS Configuration
- Configure CORS settings on the frontend to allow calls from appropriate domains
- For local development, ensure `http://localhost:3000` is allowed

### Authentication
- If using Firebase Authentication, include the user's Firebase ID token in the Authorization header
- Example header: `Authorization: Bearer <Firebase_ID_Token>`

### Error Handling
- Implement comprehensive error handling for all status codes (400, 404, 500)
- Display appropriate user-friendly messages based on error responses
- Log errors appropriately for debugging purposes

### Best Practices
- Use appropriate HTTP methods for each endpoint (GET, POST, PUT)
- Validate input data before making API calls
- Implement proper loading states while waiting for API responses
- Cache responses when appropriate to improve performance