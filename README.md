# PreciseDM

Lovable Prompt — Build PreciseDM Mobile App (Onboarding + Authentication)

Build a fully functional mobile application called PreciseDM.
This app focuses on personalized insulin dosing to optimize diabetes management.

The current task is to build Phase 1: Onboarding + Authentication Flow.

The app should be mobile-first, designed for iOS and Android, with clean medical-grade UI, calm colors (white / teal / soft blue), and smooth transitions.

All screens must support future backend connectivity.

All images, branding assets, and logo files will be provided shortly, so design the components to easily accept these assets later.

1. Launch Screen (Splash Screen)

When the app launches:

Display:

PreciseDM Logo
(Placeholder for now – to be replaced later)

Below the logo show the text:

Welcome to PreciseDM
Personalized insulin dosing to optimize diabetes management.

Button:

Next

Interaction:
When user taps Next → move to Screen 2

2. Onboarding Screen 2

Title:

Empower your insulin dosing skills for confident diabetes management

Description:

Access four powerful tools designed for every stage of your diabetes management:

• Initial dosing
• Steroid dosing
• Pregnancy care
• Ongoing maintenance

Button:

Next

Interaction:

Next → Screen 3

3. Onboarding Screen 3

Title:

Your journey begins here

Description:

Join us and take care of your health with ease and confidence.

Primary Button:

Get Started

Interaction:

Get Started → Go to Login Screen

4. Login Screen

Layout:

Top section:
PreciseDM Logo

Fields:

Email Address
Password

Buttons:

Login

Links:

Forgot Password

Skip (allows user to preview the app)

Text below:

Don't have an account? Sign Up

Login Behavior

Login validates:

• Email format
• Password required

If valid → proceed to App Home (to be built later)

If invalid → show appropriate error messages.

Skip Button Behavior

Skip allows users to explore the app without logging in, but they cannot access core medical tools or perform calculations.

Display limited preview mode.

5. Forgot Password Flow

User enters email.

System sends password reset email via Resend email service.

Lovable should request the Resend API key during setup.

Email content:

Subject: Reset Your PreciseDM Password

Body:

Hello,

We received a request to reset your password for PreciseDM.

If this was you, please follow the instructions in the app to reset your password.

If not, you can safely ignore this email.

PreciseDM Team

6. Sign Up Screen

Fields:

Full Name

Email Address

Create Password

Confirm Password

User Type (Dropdown)

Options:

• Student
• Practitioner

User ID (optional field)

User may enter any identifier (example: hospital ID, student ID, etc.)

Checkbox:

☐ I accept the Terms and Privacy Policy

Button:

Sign Up

Validation Rules

Full name required

Valid email format

Password minimum 8 characters

Passwords must match

Terms must be accepted

7. Email Confirmation After Sign Up

After successful registration:

Send email using Resend.

Subject:

Welcome to PreciseDM

Body:

Hello,

Thank you for registering on PreciseDM.

Your account has been successfully created.

You can now log in to the app using your email and password.

PreciseDM Team

8. Post Registration Flow

After successful signup:

Do NOT automatically log in the user.

Instead:

Display success message:

"Registration successful. Please log in to continue."

Then redirect user to Login Screen.

9. Backend Structure

Create the following user database fields:

User ID (auto generated)

Full Name

Email

Password (secure hashed)

User Type (Student / Practitioner)

Custom User ID (optional)

Accepted Terms (boolean)

Created At

Last Login

10. Email Infrastructure

Use:

Resend API for sending transactional emails

System must:

Prompt developer for Resend API Key

Create email functions for:

• Welcome Email
• Password Reset Email

11. Security Requirements

Passwords must be hashed and salted

Email must be unique

Implement basic rate limiting on login attempts

Ensure secure authentication tokens

12. UI / UX Requirements

Clean healthcare UI

Minimal design

Soft medical color palette

Smooth screen transitions

Large readable typography

Touch friendly buttons

Accessible form inputs

13. Code Architecture

Modular architecture.

Separate modules for:

• Authentication
• Email Services
• Onboarding Screens
• Form Validation

Ensure this is scalable for future modules including insulin calculators.

14. Future Modules (DO NOT BUILD YET)

These will be added later:

• Initial Insulin Dose Calculator
• Steroid Dose Calculator
• Pregnancy Diabetes Module
• Maintenance Dose Adjustment
• Patient Profile Tracking

Just ensure authentication supports future modules.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7ff78999-af58-4443-a884-1d10f3c1d73f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

<!-- silent-sync-marker: 2026-08-20T05:03:00Z -->
