import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Max ms to wait for a WebSocket event to propagate to another session.
const WS_TIMEOUT = 4000

// Selects only the note card container elements (note-{id}),
// excluding child elements like note-text-{id}, note-save-{id}.
const NOTE_CARDS =
  '[data-testid^="note-"]:not([data-testid^="note-text-"]):not([data-testid^="note-save-"])'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a note-text element contains the expected text,
 * regardless of whether the element is a <textarea> (value) or a regular element (textContent).
 */
async function expectNoteText(
  locator: ReturnType<Page['locator']>,
  expected: string,
  options?: { timeout?: number },
): Promise<void> {
  await expect
    .poll(
      () =>
        locator.evaluate((el: Element) =>
          el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
            ? el.value
            : el.textContent ?? '',
        ),
      options,
    )
    .toContain(expected)
}

/**
 * Navigate to the board and delete every visible note through the UI.
 * Used in beforeEach to give each test a clean slate.
 */
async function clearBoard(page: Page): Promise<void> {
  await page.goto(BASE_URL)
  await page.waitForSelector('[data-testid="board"]', { timeout: 15000 })

  const notes = page.locator(NOTE_CARDS)
  let count = await notes.count()
  while (count > 0) {
    const first = notes.first()
    const testId = await first.getAttribute('data-testid')
    const id = testId!.replace('note-', '')
    await first.click()
    const deleteBtn = page.getByTestId(`delete-btn-${id}`)
    await deleteBtn.waitFor({ state: 'visible', timeout: 3000 })
    await deleteBtn.click()
    await page.locator(`[data-testid="note-${id}"]`).waitFor({ state: 'hidden', timeout: 5000 })
    count = await notes.count()
  }
}

/**
 * Click an empty area of the board at (x, y) to create a new note.
 * Returns the new note's backend-assigned id (extracted from data-testid).
 */
async function createNote(page: Page, x = 200, y = 200): Promise<string> {
  const testIdsBefore = await page
    .locator(NOTE_CARDS)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!))

  await page.getByTestId('board').click({ position: { x, y } })

  await expect(page.locator(NOTE_CARDS)).toHaveCount(
    testIdsBefore.length + 1,
    { timeout: 5000 }
  )

  const testIdsAfter = await page
    .locator(NOTE_CARDS)
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!))

  const newTestId = testIdsAfter.find((tid) => !testIdsBefore.includes(tid))!
  return newTestId.replace('note-', '')
}

/**
 * Click a note, fill in text, click Save, then wait for the Save button to
 * disappear (confirming the save completed locally).
 */
async function saveNote(page: Page, id: string, text: string): Promise<void> {
  await page.getByTestId(`note-${id}`).click()
  await page.getByTestId(`note-text-${id}`).fill(text)
  const saveBtn = page.getByTestId(`save-btn-${id}`)
  await saveBtn.waitFor({ state: 'visible', timeout: 3000 })
  await saveBtn.click()
  await saveBtn.waitFor({ state: 'hidden', timeout: 5000 })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await clearBoard(page)
})

// ---------------------------------------------------------------------------
// TC-01: Create a note and verify it persists after reload
// ---------------------------------------------------------------------------
test('TC-01: note persists after page reload', async ({ page }) => {
  // Board should be empty after beforeEach cleanup
  await expect(page.locator(NOTE_CARDS)).toHaveCount(0)

  const id = await createNote(page, 200, 200)
  await expect(page.locator(`[data-testid="note-${id}"]`)).toBeVisible()

  await page.reload()
  await page.waitForSelector('[data-testid="board"]', { timeout: 10000 })

  await expect(page.locator(`[data-testid="note-${id}"]`)).toBeVisible()
})
