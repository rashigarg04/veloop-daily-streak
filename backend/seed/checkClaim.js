/**
 * seed/checkClaim.js
 * Script to check and verify daily streak claims for users.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // To load environment variables like MONGO_URI

// Replace with your actual User or Streak model path if needed
// import User from '../models/User.js';

async function checkClaimStatus() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/veloop-daily-streak';
    
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Database connected successfully.\n');

    // --- TODO: Implement your check logic here ---
    /*
    const users = await User.find({});
    console.log(`Found ${users.length} users in the database.`);
    
    users.forEach(user => {
      console.log(`User: ${user.email} | Last Claimed: ${user.lastClaimedDate} | Streak: ${user.streakCount}`);
    });
    */

    console.log('----------------------------------------');
    console.log('Check Claim Script Executed Successfully');
    console.log('----------------------------------------');

  } catch (error) {
    console.error('Error checking claim status:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  }
}

checkClaimStatus();