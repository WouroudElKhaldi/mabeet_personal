import webpush from "web-push";

// Prints a fresh VAPID key pair for web push. Generate once per environment and keep the private key secret.
const keys = webpush.generateVAPIDKeys();
console.log("Add these to your .env:\n");
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
