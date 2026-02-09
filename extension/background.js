// Unique identifier for the root context menu item
const MENU_PARENT_ID = "tab-tools";

// Defines all available tab sorting operations accessible from the context menu
const MENU_ITEMS = [
  { id: "reverse", title: "Reverse Selected Tabs" },
  { id: "sort-title", title: "Sort Selected Tabs by Title" },
  { id: "sort-url", title: "Sort Selected Tabs by URL" },
  { id: "random", title: "Randomly Sort Selected Tabs" },
  { id: "move-start", title: "Move Selected Tabs to Start" },
  { id: "move-end", title: "Move Selected Tabs to End" },
  { id: "undo", title: "Undo Last Action" }
];

// Stores state of the last non-undo operation to support single-level undo
let lastAction = null;

// Initialize the context menu on install and startup
// This ensures the menu structure is always available, handling browser updates/restarts
async function createMenus() {
  // Clear any existing menus to avoid duplicates
  await browser.menus.removeAll();

  // Creates the parent menu
  browser.menus.create({
    id: MENU_PARENT_ID,
    title: "Tab Sorting Tools",
    contexts: ["tab"]
  });

  // Create each child menu item under the parent
  for (const item of MENU_ITEMS) {
    browser.menus.create({
      id: item.id,
      parentId: MENU_PARENT_ID,
      title: item.title,
      contexts: ["tab"]
    });
  }
}

// Ensure menus are created when the extension is installed or Firefox starts
browser.runtime.onInstalled.addListener(createMenus);
browser.runtime.onStartup.addListener(createMenus);

// Records the current tab order before any manipulation operation
// Used by undoLastAction() to restore tabs to their previous positions
function saveUndoState(tabs) {
  lastAction = {
    windowId: tabs[0].windowId,
    tabs: tabs.map(tab => ({
      id: tab.id,
      index: tab.index
    }))
  };
}

// Restores tabs to their previous positions if undo data is available
// Clears undo state after restoring to prevent accidental double-undos
async function undoLastAction() {
  if (!lastAction) {
    await browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Tab Sorting Tools",
      message: "Nothing to undo."
    });
    return;
  }

  // Sort by original index to handle cases where tabs were moved in various orders
  const sortedByIndex = [...lastAction.tabs].sort((a, b) => a.index - b.index);

  for (const tab of sortedByIndex) {
    await browser.tabs.move(tab.id, {
      index: tab.index,
      windowId: lastAction.windowId
    });
  }

  // Clear undo state after applying
  lastAction = null;

  await browser.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-48.png",
    title: "Tab Sorting Tools",
    message: "Last action undone."
  });
}

// Fisher–Yates shuffle algorithm for random tab ordering
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Main handler for tab context menu interactions
browser.menus.onClicked.addListener(async (info) => {
  try {
    // Handle undo action separately since it doesn't require tab selection
    if (info.menuItemId === "undo") {
      await undoLastAction();
      return;
    }

    // Get all highlighted tabs in the current window (user's multi-selection)
    const tabs = await browser.tabs.query({
      highlighted: true,
      currentWindow: true
    });

    // Sorting operations require at least 2 tabs
    if (tabs.length < 2) return;

    // Save current state before performing any operation
    saveUndoState(tabs);

    let orderedTabs = [...tabs];

    // Apply the selected sorting/rearrangement operation
    switch (info.menuItemId) {
      case "reverse":
        orderedTabs.reverse();
        break;

      case "sort-title":
        orderedTabs.sort((a, b) => a.title.localeCompare(b.title));
        break;

      case "sort-url":
        orderedTabs.sort((a, b) => a.url.localeCompare(b.url));
        break;

      case "random":
        shuffleArray(orderedTabs);
        break;

      case "move-start":
        await browser.tabs.move(
          orderedTabs.map(t => t.id),
          { index: 0 }
        );
        return;

      case "move-end":
        const allTabs = await browser.tabs.query({ currentWindow: true });
        await browser.tabs.move(
          orderedTabs.map(t => t.id),
          { index: allTabs.length - 1 }
        );
        return;

      default:
        return;
    }

    // Move tabs to their new positions starting from the original selection's location
    for (let i = 0; i < orderedTabs.length; i++) {
      await browser.tabs.move(orderedTabs[i].id, {
        index: tabs[0].index + i
      });
    }

    await browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Tab Sorting Tools",
      message: "Action completed successfully."
    });

  } catch (err) {
    console.error("Tab Sorting Tools error:", err);
  }
});
