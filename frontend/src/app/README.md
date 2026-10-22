# Loan Collection Agent App

A comprehensive mobile application for loan collection agents to manage their daily tasks efficiently.

## Features

- **Agent Dashboard**: Overview of daily tasks and performance metrics
- **Customer Management**: Complete customer profiles with loan details
- **Payment Collection**: Record payments with receipt generation
- **Visit Tracking**: GPS-enabled visit logging and proof collection
- **Communication Tools**: Integrated calling, WhatsApp, and SMS capabilities
- **Performance Analytics**: Agent performance tracking and analytics
- **Attendance Management**: Check-in/check-out with location tracking
- **Task Management**: Follow-up reminders and task scheduling
- **Repayment Summary**: Detailed loan and EMI schedules

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI + shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts
- **Build Tool**: Vite
- **State Management**: React Hooks

## Setup Instructions

1. **Clone the repository** (or copy all files to your project directory)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   └── figma/           # Figma-related components
├── styles/              # CSS styles
└── App.tsx              # Main application component
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features Overview

### Authentication & Security
- Secure login with role-based access
- Agent profile management
- Location-based check-in/check-out

### Customer Management
- Comprehensive customer profiles
- Loan details and payment history
- Co-applicant information
- Communication logs

### Payment Processing
- EMI payment collection
- Receipt generation
- Payment history tracking
- Multiple payment methods

### Field Operations
- GPS-enabled visit tracking
- Photo proof collection
- Offline capability
- Real-time sync

### Analytics & Reporting
- Agent performance metrics
- Visit analytics
- Collection reports
- Audit trails

## Mobile-First Design

This application is optimized for mobile devices and field work:
- Touch-friendly interface
- Responsive design
- Offline capabilities
- GPS integration
- Camera integration for proof collection

## Currency & Localization

- Uses Indian Rupee (₹) currency
- Indian customer names and data
- Localized date formats
- Regional compliance features

## Development Notes

- All components are TypeScript-enabled
- Uses Tailwind CSS v4 with custom design tokens
- Implements shadcn/ui component library
- Mobile-first responsive design
- Optimized for performance

## Support

For any issues or questions, please refer to the component documentation or create an issue in the repository.