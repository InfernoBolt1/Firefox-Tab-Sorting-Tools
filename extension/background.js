// Parent ID for the tab context menu entry
const MENU_PARENT_ID = "tab-tools";

// Definition of all child menu items shown under "Tab Sorting Tools"
const MENU_ITEMS = [
  { id: "reverse", title: "Reverse Selected Tabs" },
  { id: "sort-title", title: "Sort Selected Tabs by Title" },
  { id: "sort-url", title: "Sort Selected Tabs by URL" },
  { id: "random", title: "Randomly Sort Selected Tabs" },
  { id: "move-start", title: "Move Selected Tabs to Start" },
  { id: "move-end", title: "Move Selected Tabs to End" },
  { id: "undo", title: "Undo Last Action" }
];

// Stores the most recent tab operation to allow a single-level undo
let lastAction = null;

// Creates (or recreates) the tab context menu structure
// Called on install and on browser startup to ensure menus exist
async function createMenus() {
  // Clear any existing menus to avoid duplicates
  await browser.menus.removeAll();

  // Create the parent menu item
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

// Saves the current tab order so it can be restored later via undo
function saveUndoState(tabs) {
  lastAction = {
    windowId: tabs[0].windowId,
    tabs: tabs.map(tab => ({
      id: tab.id,
      index: tab.index
    }))
  };
}

// Restores the previous tab order if an undo state exists
async function undoLastAction() {
  if (!lastAction) {
    // Inform the user if there is nothing to undo
    await browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Tab Sorting Tools",
      message: "Nothing to undo."
    });
    return;
  }

  // Sort tabs by their original index to ensure correct restoration order
  const sortedByIndex = [...lastAction.tabs].sort((a, b) => a.index - b.index);

  for (const tab of sortedByIndex) {
    await browser.tabs.move(tab.id, {
      index: tab.index,
      windowId: lastAction.windowId
    });
  }

  // Clear the undo state once applied
  lastAction = null;

  await browser.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-48.png",
    title: "Tab Sorting Tools",
    message: "Last action undone."
  });
}

// In-place Fisher–Yates shuffle used for random tab ordering
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Handles clicks on any of the context menu items
browser.menus.onClicked.addListener(async (info) => {
  try {
    // Undo is handled separately as it does not require selected tabs
    if (info.menuItemId === "undo") {
      await undoLastAction();
      return;
    }

    // Get all currently highlighted (multi-selected) tabs in the window
    const tabs = await browser.tabs.query({
      highlighted: true,
      currentWindow: true
    });

    // No action needed if fewer than two tabs are selected
    if (tabs.length < 2) return;

    // Save current state before performing any operation
    saveUndoState(tabs);

    let orderedTabs = [...tabs];

    // Perform the selected operation
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

    // Apply the new tab order starting from the first selected tab’s position
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
