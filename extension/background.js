// Constants
const MENU_PARENT_ID = "tab-tools";
const MENU_ITEMS = [
  { id: "reverse", title: "Reverse Selected Tabs" },
  { id: "sort-title", title: "Sort Selected Tabs by Title" },
  { id: "sort-url", title: "Sort Selected Tabs by URL" },
  { id: "move-start", title: "Move Selected Tabs to Start" },
  { id: "move-end", title: "Move Selected Tabs to End" },
];

// Create context menus on install/update
browser.runtime.onInstalled.addListener(async () => {
  await browser.contextMenus.removeAll(); // 🧹 Clear old menus

  // Parent menu
  browser.contextMenus.create({
    id: MENU_PARENT_ID,
    title: "Tab Sorting Tools",
    contexts: ["tab"]
  });

  // Submenus
  MENU_ITEMS.forEach(item => {
    browser.contextMenus.create({
      id: item.id,
      title: item.title,
      parentId: MENU_PARENT_ID,
      contexts: ["tab"]
    });
  });
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!MENU_ITEMS.map(item => item.id).includes(info.menuItemId)) {
    return;
  }

  try {
    const selectedTabs = await browser.tabs.query({ highlighted: true, currentWindow: true });

    if (!selectedTabs || selectedTabs.length < 2) {
      console.log("Less than two tabs selected or none found.");
      return;
    }

    selectedTabs.sort((a, b) => a.index - b.index);
    const originalIndices = selectedTabs.map(tab => tab.index);
    const tabIds = selectedTabs.map(tab => tab.id);

    switch (info.menuItemId) {
      case "reverse": {
        const reversedTabIds = [...tabIds].reverse();
        for (let i = 0; i < reversedTabIds.length; i++) {
          await browser.tabs.move(reversedTabIds[i], { index: originalIndices[i] });
        }
        break;
      }

      case "sort-title": {
        const sortedTabs = [...selectedTabs].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
        for (let i = 0; i < sortedTabs.length; i++) {
          await browser.tabs.move(sortedTabs[i].id, { index: originalIndices[i] });
        }
        break;
      }

      case "sort-url": {
        const sortedTabs = [...selectedTabs].sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }));
        for (let i = 0; i < sortedTabs.length; i++) {
          await browser.tabs.move(sortedTabs[i].id, { index: originalIndices[i] });
        }
        break;
      }

      case "move-start": {
        for (let i = 0; i < tabIds.length; i++) {
          await browser.tabs.move(tabIds[i], { index: i });
        }
        break;
      }

      case "move-end": {
        const allTabs = await browser.tabs.query({ currentWindow: true });
        const endIndex = allTabs.length;
        for (let i = 0; i < tabIds.length; i++) {
          await browser.tabs.move(tabIds[i], { index: endIndex + i });
        }
        break;
      }
    }

    // 🔔 Optional user feedback
    await browser.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png", // Optional - replace with your icon path if available
      title: "Tab Tools",
      message: `Action "${info.menuItemId.replace(/-/g, ' ')}" completed.`
    });

    console.log(`Action "${info.menuItemId}" completed.`);
  } catch (err) {
    console.error(`Error during "${info.menuItemId}":`, err);
  }
});
