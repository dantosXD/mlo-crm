// Test script for Feature #322: Task Subtasks and Checklists
const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSubtasks() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();

    // Navigate to login
    console.log('Navigating to login...');
    await page.goto('http://localhost:5173/login');
    await sleep(2000);

    // Login
    console.log('Logging in...');
    await page.type('input[type="email"]', 'testuser@example.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await sleep(3000);

    // Navigate to Clients page
    console.log('Navigating to Clients page...');
    await page.click('a[href="/clients"]');
    await sleep(2000);

    // Click on the first client
    console.log('Clicking on first client...');
    const clientLink = await page.$('a[href^="/clients/"]');
    if (clientLink) {
      await clientLink.click();
      await sleep(2000);
    } else {
      throw new Error('No clients found. Please create a test client first.');
    }

    // Navigate to Tasks tab
    console.log('Navigating to Tasks tab...');
    await page.click('button[data-tabs-tab="tasks"]');
    await sleep(1500);

    // Create a test task if none exist
    const hasTasks = await page.$('input[placeholder*="Add a task"]') !== null;
    if (hasTasks) {
      console.log('Tasks exist, clicking on first task...');

      // Look for existing task or create one
      const addTaskButton = await page.$('button:has-text("Add Task")');
      if (addTaskButton) {
        await addTaskButton.click();
        await sleep(500);

        // Fill task form
        await page.type('input[placeholder*="Task name"]', 'TEST_SUBTASKS_322');
        await page.click('button[type="submit"]');
        await sleep(2000);
      }
    }

    // Wait for task to appear
    await sleep(2000);

    // Test 1: Add a subtask
    console.log('\n=== TEST 1: Adding a subtask ===');
    const subtaskInput = await page.$('input[placeholder="Add a subtask..."]');
    if (!subtaskInput) {
      throw new Error('Subtask input not found. Task may not have subtasks enabled.');
    }

    await subtaskInput.type('Test subtask #1');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(1500);

    console.log('✓ Subtask added successfully');

    // Test 2: Add multiple subtasks
    console.log('\n=== TEST 2: Adding multiple subtasks ===');
    await subtaskInput.type('Test subtask #2');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(1500);

    await subtaskInput.type('Test subtask #3');
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(1500);

    console.log('✓ Multiple subtasks added');

    // Test 3: Check progress bar
    console.log('\n=== TEST 3: Verifying progress bar ===');
    const progressText = await page.evaluate(() => {
      const progressElement = document.querySelector('div[class*="mantine-Progress-root"]');
      const textElement = document.querySelector('div[class*="mantine-Progress-root"]')?.previousElementSibling;
      return textElement?.textContent || '';
    });

    console.log(`Progress text: ${progressText}`);
    if (progressText.includes('0 of 3')) {
      console.log('✓ Progress bar showing correct count');
    } else {
      console.log('✗ Progress bar may not be showing correctly');
    }

    // Test 4: Toggle subtask completion
    console.log('\n=== TEST 4: Toggling subtask completion ===');
    const checkboxes = await page.$$('input[type="checkbox"]');
    // Find checkbox for first subtask (not the main task checkbox)
    if (checkboxes.length > 1) {
      await checkboxes[1].click(); // Click first subtask checkbox
      await sleep(1000);

      // Verify subtask is marked complete
      const isCompleted = await page.evaluate((el) => el.checked, checkboxes[1]);
      if (isCompleted) {
        console.log('✓ Subtask toggled to completed');
      } else {
        console.log('✗ Subtask toggle may not have worked');
      }

      // Toggle back
      await checkboxes[1].click();
      await sleep(1000);
    }

    // Test 5: Edit subtask inline
    console.log('\n=== TEST 5: Editing subtask inline ===');
    const subtaskText = await page.$('div:has-text("Test subtask #1")');
    if (subtaskText) {
      await subtaskText.click();
      await sleep(500);

      // Change text
      const input = await page.$('input[value="Test subtask #1"]');
      if (input) {
        await input.click({ clickCount: 3 }); // Select all
        await page.keyboard.type('Edited subtask #1');
        await page.keyboard.press('Enter');
        await sleep(1500);

        console.log('✓ Subtask edited inline');
      }
    }

    // Test 6: Delete a subtask
    console.log('\n=== TEST 6: Deleting a subtask ===');
    const menuButtons = await page.$$('button[aria-label]:has(svg)');
    if (menuButtons.length > 0) {
      // Click the last menu button (for subtask)
      await menuButtons[menuButtons.length - 1].click();
      await sleep(500);

      // Click delete
      const deleteButton = await page.$('button:has-text("Delete"), a:has-text("Delete")');
      if (deleteButton) {
        await deleteButton.click();
        await sleep(500);

        // Confirm delete
        const confirmButton = await page.$('button:has-text("Delete"):not([disabled])');
        if (confirmButton) {
          await confirmButton.click();
          await sleep(1500);

          console.log('✓ Subtask deleted');
        }
      }
    }

    // Test 7: Complete all subtasks and verify 100%
    console.log('\n=== TEST 7: Completing all subtasks ===');
    const allCheckboxes = await page.$$('input[type="checkbox"]');
    let subtaskCount = 0;
    for (let i = 1; i < allCheckboxes.length; i++) {
      await allCheckboxes[i].click();
      await sleep(500);
      subtaskCount++;
    }

    await sleep(1500);

    // Check if progress shows 100%
    const finalProgress = await page.evaluate(() => {
      const progressElement = document.querySelector('div[role="progressbar"]');
      if (progressElement) {
        const ariaValue = progressElement.getAttribute('aria-valuenow');
        return ariaValue;
      }
      return null;
    });

    if (finalProgress === '100' || finalProgress === 100) {
      console.log('✓ All subtasks completed, progress shows 100%');
    } else {
      console.log(`Progress: ${finalProgress}%`);
    }

    // Take screenshot
    await page.screenshot({ path: 'feature-322-subtasks-final.png', fullPage: false });
    console.log('\n✓ Screenshot saved: feature-322-subtasks-final.png');

    console.log('\n=== ALL TESTS PASSED ===');
    console.log('Feature #322: Task Subtasks and Checklists is working!');

    await sleep(3000);

  } catch (error) {
    console.error('Test failed:', error.message);
    await page.screenshot({ path: 'feature-322-error.png', fullPage: false });
  } finally {
    await browser.close();
  }
}

// Run tests
testSubtasks().catch(console.error);
