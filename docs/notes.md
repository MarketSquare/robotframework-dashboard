---
outline: deep
---

# Notes

Notes let you write down what you found out about a test result: a link to the bug that makes it fail, or the reason a failure can be ignored, for example "passed, but the suite teardown failed". You can add a note to a **test in a specific run**, whether it failed, passed or was skipped, and give it a category such as *Product bug* or *Environment*.

Notes are stored in your browser, so they work the same in a dashboard file you open locally and in a dashboard hosted with `--server`. Nothing is written to the database or the HTML file.

::: warning Notes are stored per browser
Your notes are only visible in the browser you made them in. Other people, other browsers and private windows do not see them, and clearing the browser data removes them. Use [Export](#import-and-export) to keep a copy or to share notes with someone else.
:::

## Turning notes on

Notes are off by default. Open **Settings**, go to the **Defaults** tab and turn on **Test Notes**. This adds:

- the Notes button in the menu bar
- the right-click menu on the test graphs
- the **Test Notes** widget at the bottom of the Test section
- a **note** column in the Test table on the Tables page
- the notes in the graph tooltips and the colored border around tests with a note

Turning the setting off again hides all of this. Your notes stay stored and come back when you turn it on.

## Adding a note

There are two ways to add or edit a note.

**Right-click in a graph.** Right-click a test in one of these graphs and choose **Add note**:

- Test Statistics (timeline and line view)
- Most Failed, Recent Most Failed, Most Flaky and Recent Most Flaky (timeline view)
- Compare Tests on the Compare page

The menu also has **Open log** when [log linking](log-linking.md) is enabled. A normal click keeps opening the log, as before. Right-clicking anywhere else in a graph shows the normal browser menu.

**The pencil button.** The **Test Notes** widget lists the failed tests and the tests with a note of the filtered runs. Click the pencil in a row to add or edit its note. The Test table on the Tables page has the same pencil in its **note** column, for every test.

The note editor shows the run, the test and its message. Write the note, pick a category if you like, and click **Save Note** (or press Ctrl+Enter). Dismissing the editor by clicking outside it also saves your changes. Links that start with `http://` or `https://` become clickable. A note can be up to 2000 characters. To remove a note, click **Delete Note**, or save it with an empty text and no category.

## Where notes are shown

| Place | What you see |
|---|---|
| Graph tooltips | The category and the note below the test message |
| Test timeline graphs | A border in the category color around a test that has a note |
| Test Notes widget | Every failed test and every test with a note of the filtered runs, with its status and note, and a summary: how many failures there are, how many have no note yet, and how many notes have each category |
| Tables page | A **note** column in the Test table, which the table search also searches |

The Test Notes widget follows the filters and the section filters of the Test section, like the Most Failed graphs. It can be hidden or moved in the layout editor like any other graph, see [Customization](customization.md).

## Categories

A category groups notes, for example by the cause of the failure. You define the categories yourself, there is no fixed list. Each category has a name and a color, and a note has at most one category.

- To add a category while writing a note, click **New Category** in the note editor.
- To rename, recolor or delete categories, open the Notes button in the menu bar and go to the **Categories** tab.

When you delete a category, the notes that used it keep their text. A note that only had the category and no text is removed.

## The Notes button

The Notes button in the menu bar opens an overview of all your notes. Changes are stored right away, and the graphs and tables show them once you close the modal, like the filter and settings modals.

| Tab | Contents |
|---|---|
| Notes | Every note on a test of this dashboard, newest first, with an edit button per note. Turn on **Update mode** to select notes and delete them in bulk |
| Unmatched | Notes whose run or test is not in this dashboard |
| Categories | Add, rename, recolor and delete categories |
| Import / Export | Download or copy your notes as JSON, and import notes |

The top of the window shows how much of the browser storage is used.

### Unmatched notes

All dashboards that are opened from the same location share one browser storage. In Chrome, for example, every dashboard file that you open from your own disk shares it, and every dashboard on the same server address shares it. A note that belongs to another dashboard, or to a run that was removed with `--removeruns`, therefore shows up under **Unmatched** in this dashboard.

The dashboard never deletes these notes by itself, because it cannot tell a note of another dashboard from a note of a removed run. Check them and delete the ones you no longer need with **Delete Selected** or **Delete All Unmatched**.

### Import and export

**Download Notes JSON** saves all notes and categories, including the unmatched notes, to a file. **Copy Notes JSON** puts the same JSON on the clipboard.

To import, choose a file or paste the JSON and click **Import Notes**. Imported notes are added to the notes you already have:

- A note that you do not have yet is added.
- When a note exists in both, the one that was changed last is kept.
- An imported category with the same name as one of yours is merged into yours. Other imported categories are added.

## Storage limit

Browsers allow about 5 MB of storage per location. The notes share that space with the dashboard settings, saved layouts and filter profiles. While notes are turned on and more than 80% is used, a warning bar shows on every page of the dashboard. You can close it, it comes back after a reload while the storage stays this full.

When the storage is full, a note cannot be saved. You get a message, your text stays in the editor, and the editor stays open. Export your notes and delete the ones you no longer need, starting with the unmatched notes.
