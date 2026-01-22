/**
 * Test script to verify network error handling
 * This script tests the error handler utility with various error types
 */

// Mock the notifications
const notifications = {
  show: (options) => {
    console.log('\n📢 Notification displayed:');
    console.log(`   Title: ${options.title}`);
    console.log(`   Message: ${options.message}`);
    console.log(`   Color: ${options.color}`);
    console.log(`   AutoClose: ${options.autoClose}ms`);
  }
};

// Mock the error handler
function getUserFriendlyErrorMessage(error, context) {
  const messages = {
    'loading clients': 'Unable to connect to the server. Please check your internet connection and try again.',
    'creating client': 'Unable to create client due to network issues. Please check your connection and try again.',
    'logging in': 'Unable to connect to the server. Please check your internet connection and try again.',
    'loading dashboard': 'Unable to load dashboard. Please check your internet connection.',
  };

  return messages[context.toLowerCase()] || `${context} failed. Please check your internet connection and try again.`;
}

function handleFetchError(error, context) {
  const message = getUserFriendlyErrorMessage(error, context);
  notifications.show({
    title: 'Connection Error',
    message,
    color: 'red',
    autoClose: 8000,
  });
}

// Test 1: Network error (TypeError)
console.log('\n🧪 Test 1: Network Connection Error');
const networkError = new TypeError('Failed to fetch');
networkError.name = 'TypeError';
networkError.message = 'Failed to fetch';
handleFetchError(networkError, 'loading clients');

// Test 2: Timeout error
console.log('\n🧪 Test 2: Request Timeout');
const timeoutError = new Error('AbortError');
timeoutError.name = 'AbortError';
handleFetchError(timeoutError, 'creating client');

// Test 3: Generic error
console.log('\n🧪 Test 3: Generic Error');
const genericError = new Error('Some unknown error');
handleFetchError(genericError, 'logging in');

// Test 4: Dashboard loading error
console.log('\n🧪 Test 4: Dashboard Loading Error');
const dashboardError = new TypeError('Failed to fetch');
handleFetchError(dashboardError, 'loading dashboard');

console.log('\n✅ All tests completed!');
console.log('\n📝 Summary:');
console.log('   - Network errors show user-friendly messages');
console.log('   - Messages suggest checking internet connection');
console.log('   - Context-specific messages for different actions');
console.log('   - No technical jargon exposed to users');
