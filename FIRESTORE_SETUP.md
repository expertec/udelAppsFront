# Firestore Security Rules Setup

This document explains how to deploy the Firestore security rules to fix the "Missing or insufficient permissions" error.

## The Problem

The error `FirebaseError: Missing or insufficient permissions` occurs when Firestore security rules block write operations to the database. This typically happens when:

1. No security rules are configured (default deny-all rules)
2. The user is not authenticated
3. The user doesn't have the required permissions (e.g., not approved by admin)

## The Solution

We've created proper security rules that allow:
- ✅ Authenticated and approved users to create video analysis jobs
- ✅ Users to read their own analyses
- ✅ Admins to manage all resources
- ❌ Unauthenticated users from accessing the database

## Deployment Options

### Option 1: Deploy via Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not already done):
   ```bash
   firebase init
   ```
   - Select "Firestore" when prompted
   - Choose the existing project `udel-tools`
   - Accept the default `firestore.rules` file

4. **Deploy the rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Verify deployment**:
   - Go to [Firebase Console](https://console.firebase.google.com/project/udel-tools/firestore/rules)
   - You should see the new rules applied

### Option 2: Manual Deployment via Firebase Console

1. **Open Firebase Console**:
   - Go to https://console.firebase.google.com/project/udel-tools/firestore/rules

2. **Copy the rules**:
   - Open the `firestore.rules` file in this project
   - Copy all the content

3. **Paste and publish**:
   - Paste the rules into the Firebase Console editor
   - Click "Publish" to apply the changes

## Security Rules Overview

### Users Collection (`/users/{userId}`)
- **Read**: Users can read their own data, admins can read all
- **Create**: New users can create their own document during signup (with `approved: false`)
- **Update**: Users can update their profile (except role/approved), admins can update everything
- **Delete**: Only admins

### Analyses Collection (`/analyses/{analysisId}`)
- **Create**: Authenticated + approved users can create their own analyses
- **Read**: Users can read their own analyses, admins can read all
- **Update**: Users can update their own analyses (for real-time status)
- **Delete**: Only admins

### Apps Collection (`/apps/{appId}`)
- **Read**: All authenticated and approved users
- **Write**: Only admins

## Verifying User Approval

After deploying the rules, ensure users are properly approved:

1. Go to [Firestore Database](https://console.firebase.google.com/project/udel-tools/firestore/data)
2. Navigate to the `users` collection
3. For each user document, verify:
   - `approved: true` (for regular users who should have access)
   - `role: 'admin'` or `role: 'user'`

## Testing the Fix

1. **Reload the application** and log in
2. **Try uploading a video** in the dashboard
3. **Expected behavior**:
   - If approved: Video upload should work
   - If not approved: Clear error message explaining approval is needed
   - If not authenticated: Prompt to reload and login

## Common Issues

### Issue: Still getting permission errors after deployment
**Solution**:
- Clear browser cache and cookies
- Log out and log back in
- Verify the rules are published in Firebase Console

### Issue: "No session" error
**Solution**:
- The user's authentication token may have expired
- Ask user to reload the page and login again

### Issue: Rules deployed but user can't create analyses
**Solution**:
- Check that the user's `approved` field is `true` in Firestore
- Check that the user has `role: 'user'` or `role: 'admin'`

## Additional Resources

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Testing Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
