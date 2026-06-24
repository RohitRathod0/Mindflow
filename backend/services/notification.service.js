const webpush = require('web-push');

// Configure VAPID on module load (only if keys are present)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:test@flowmind.ai',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * sendNotification(subscriptionObj, title, body, data)
 * Non-blocking — logs error on fail, does not throw
 */
async function sendNotification(subscriptionObj, title, body, data = {}) {
  try {
    await webpush.sendNotification(
      subscriptionObj,
      JSON.stringify({ title, body, data })
    );
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }
}

module.exports = { sendNotification };
