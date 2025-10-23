# Email Configuration Note

## Bug Report & Feedback Forms

The bug report and feedback forms have been created and integrated into the Settings page.

### Current Implementation
- Forms collect user feedback and bug reports
- User email is pre-filled from their profile
- Forms include validation and loading states
- **Currently using mailto: links** - opens user's default email client with pre-filled content
- This works immediately without any backend configuration

### Upgrade to Automated Email Sending (Optional)

If you want to replace the mailto: fallback with automated email sending, you can:

1. **Choose an Email Service Provider:**
   - Sendgrid
   - Mailgun
   - AWS SES
   - Postmark
   - etc.

2. **Add API Keys to Secrets:**
   ```
   EMAIL_API_KEY=your_api_key_here
   EMAIL_FROM=noreply@dobl.uk
   EMAIL_TO=no-reply@dobl.uk
   ```

3. **Implement `/api/send-email` Endpoint:**
   Add this route to `server/routes.ts`:

   Example with SendGrid:
   ```typescript
   app.post('/api/send-email', async (req, res) => {
     const { to, subject, body } = req.body;
     
     // Use your chosen email service here
     // await emailService.send({ to, subject, body });
     
     res.json({ success: true });
   });
   ```

4. **Update Form Submission Logic:**
   Replace the mailto: link code in both forms with the API call (the old code is commented in the file for reference).

### Forms Created
- **BugReportForm** (`client/src/components/BugReportForm.tsx`)
  - Uses mailto: link to open email client
  - Pre-fills recipient, subject, and body
  
- **FeedbackForm** (`client/src/components/FeedbackForm.tsx`)
  - Includes 5-star rating system
  - Uses mailto: link to open email client
  - Pre-fills recipient, subject, rating, and feedback

Both forms include proper validation, loading states, and toast notifications.
