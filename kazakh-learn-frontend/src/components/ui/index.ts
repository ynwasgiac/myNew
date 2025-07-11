// src/components/ui/index.ts
// Export your existing LoadingSpinner and new components
export { default as Button } from './Button';
export { default as Badge } from './Badge';
export { default as LoadingSpinner } from './LoadingSpinner'; // Your existing component
export { default as Modal } from './Modal';

// Note: Only create Button, Badge, and Modal if they don't already exist
// Use your existing LoadingSpinner as it's already perfect for the admin panel