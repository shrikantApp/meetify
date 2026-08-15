#!/bin/bash

# Start Backend
cd backend
npm run start:dev &

# Start Frontend
cd ../frontend
npm run dev &

# Keep both processes running
wait