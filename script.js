document.addEventListener('DOMContentLoaded', async () => {
    // ——— Cached DOM refs ———
    const mainCategoriesContainer = document.getElementById('main-categories');
    const additionalTagsContainer = document.getElementById('additional-tags');
    const platformSettingsContainer = document.getElementById('platform-settings');
    const generateBtn = document.getElementById('generate-btn');
    const outputArea = document.getElementById('output-area');
    const addCaptionBtn = document.getElementById('add-caption-btn');
    const addHashtagBtn = document.getElementById('add-hashtag-btn');
    const viewCaptionsBtn = document.getElementById('view-captions-btn');
    const viewHashtagsBtn = document.getElementById('view-hashtags-btn');
    const platformSettingsHeader = document.getElementById('platform-settings-header'); // Get header
    const platformSettingsSection = platformSettingsHeader.closest('.collapsible-section'); // Get parent section
    const customHashtagsInput = document.getElementById('custom-hashtags-input'); // Get custom hashtags input
    const customHashtagsHeader = document.getElementById('custom-hashtags-header'); // Get custom hashtags header
    const customHashtagsSection = document.getElementById('custom-hashtags-section'); // Get custom hashtags section
    const platformExclusionsContainer = document.getElementById('platform-exclusions'); // Container for exclusion checkboxes

    // Modal elements
    const captionsModalOverlay = document.getElementById('captions-modal-overlay');
    const captionsModalBody = document.getElementById('captions-modal-body');
    const closeCaptionsModalBtn = document.getElementById('close-captions-modal');
    const hashtagsModalOverlay = document.getElementById('hashtags-modal-overlay');
    const hashtagsModalBody = document.getElementById('hashtags-modal-body');
    const closeHashtagsModalBtn = document.getElementById('close-hashtags-modal');

    // Caption Modal Filters & Table
    const filterCaptionIdentifierSelect = document.getElementById('filter-caption-identifier');
    const filterCaptionPlatformSelect = document.getElementById('filter-caption-platform');
    const filterCaptionCharTotalInput = document.getElementById('filter-caption-char-total');
    const captionsTableBody = document.getElementById('captions-table-body');

    // Hashtag Modal Filters & Table
    const filterIdentifierSelect = document.getElementById('filter-identifier');
    const filterPlatformSelect = document.getElementById('filter-platform');
    const filterTypeSelect = document.getElementById('filter-type');
    const hashtagsTableBody = document.getElementById('hashtags-table-body');

    const addCaptionsModalOverlay = document.getElementById('add-captions-modal-overlay');
    const closeAddCaptionsModalBtn = document.getElementById('close-add-captions-modal');
    const addCaptionsCategoryBtns = document.getElementById('add-captions-category-btns');
    const addCaptionsPlatformBtns = document.getElementById('add-captions-platform-btns');
    const addCaptionsInputArea = document.getElementById('add-captions-input-area');
    const addAnotherCaptionBtn = document.getElementById('add-another-caption-btn');
    const submitAddCaptionsBtn = document.getElementById('submit-add-captions-btn');

    const addHashtagsModalOverlay = document.getElementById('add-hashtags-modal-overlay');
    const closeAddHashtagsModalBtn = document.getElementById('close-add-hashtags-modal');
    const addHashtagsCategoryBtns = document.getElementById('add-hashtags-category-btns');
    const addHashtagsTagsBtns = document.getElementById('add-hashtags-tags-btns');
    const addHashtagsPlatformBtns = document.getElementById('add-hashtags-platform-btns');
    const addHashtagsTypeBtns = document.getElementById('add-hashtags-type-btns');
    const addHashtagsInput = document.getElementById('add-hashtags-input');
    const submitAddHashtagsBtn = document.getElementById('submit-add-hashtags-btn');

    const platforms = ["Instagram", "TikTok", "Facebook", "Threads", "Twitter", "Bluesky", "Spoutible"];
    const selectedState = {
        category: null,
        tags: new Set(),
        settings: {},
        customHashtags: '',
        excludeCustomHashtags: new Set() // Add property for platform exclusions
    };

    const addCaptionState = {
        category: null,
        platforms: new Set()
    };

    const addHashtagState = {
        categories: new Set(),
        tags: new Set(),
        platforms: new Set(),
        type: null
    };

    // ——— Toast helper ———
    function showToast(msg, isError = false) {
        const existing = document.querySelector('.toast');

        if (existing) {
            // Start fade-out transition
            existing.style.opacity = '0';

            // After fade-out completes (300ms), remove and show new toast
            setTimeout(() => {
                existing.remove();
                createToast(msg, isError);
            }, 300);
        } else {
            createToast(msg, isError);
        }

        function createToast(message, error) {
            const t = document.createElement('div');
            t.className = 'toast' + (error ? ' error' : '');
            t.innerHTML = message.replace(/\n/g, '<br>');
            t.style.opacity = '0'; // Start hidden for fade-in
            t.style.textAlign = 'center';

            document.body.appendChild(t);

            // Trigger fade-in
            requestAnimationFrame(() => {
                t.style.opacity = '1';
            });

            // Fade out and remove after duration
            setTimeout(() => {
                t.style.opacity = '0';
                setTimeout(() => t.remove(), 300);
            }, 3000);
        }
    }

    // ——— Google Sheets & IndexedDB Setups ———
    const SHEET_ID = "15121EMhmrUMDrdkcr9vbePnMGtI67ilEYICaoAkFiDM";
    const SHEET_NAME_CAPTIONS = 'CaptionBank';
    const SHEET_NAME_HASHTAGS = 'HashtagBank';
    //const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbxfCKH07OQ7-X5HDqRpsyzKkTXEvG5AO2NTZKYs3TdYZAEu08hfO2Y8ZheggiIghcXM/exec";
    const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbwxPEluvEcxdG2DLcDSOzatbwEx5sDAJNN9NVCOKkPRD2HIiA-_jW-gi4FKyUrppggZ/exec";
    const DB_NAME = 'ARTeezCaptionHashtagGeneratorDB';
    const STORE_CAPTIONS = 'captions';
    const STORE_HASHTAGS = 'hashtags';
    const STORE_SETTINGS = 'platformSettings';

    // ——— Initialize IndexedDB ———
    function getDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
              request.onupgradeneeded = e => {
                  const db = e.target.result;
                  // Platform settings store with explicit keyPath
                  if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                      db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
                      console.log('🆕 Created object store:', STORE_SETTINGS);
                  }
                  // Captions store with autoIncrement keys
                  if (!db.objectStoreNames.contains(STORE_CAPTIONS)) {
                      db.createObjectStore(STORE_CAPTIONS, { autoIncrement: true });
                      console.log('🆕 Created object store:', STORE_CAPTIONS);
                  }
                  // Hashtags store with autoIncrement keys
                  if (!db.objectStoreNames.contains(STORE_HASHTAGS)) {
                      db.createObjectStore(STORE_HASHTAGS, { autoIncrement: true });
                      console.log('🆕 Created object store:', STORE_HASHTAGS);
                  }
              };
              request.onsuccess = e => {
                  console.log('✅ IndexedDB opened successfully');
                  resolve(e.target.result);
              };
              request.onerror = e => {
                  console.error('❌ Failed to open IndexedDB', e);
                  reject(e);
              };
        });
    }

    // ——— Store IndexedDB store information to memory for filtering access ———
    async function getAllFromIndexedDB(storeName) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ——— Add new information to IndexedDB (add captions, hashtags) ———
    async function addToIndexedDB(storeName, dataArray) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        dataArray.forEach(item => store.add(item));
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e);
    });
}


    // ——— Function to load platform settings ———
    async function loadPlatformSettings() {
      try {
        const db = await getDB();
        const tx = db.transaction(STORE_SETTINGS, "readonly");
        const store = tx.objectStore(STORE_SETTINGS);

        const result = await new Promise((resolve, reject) => {
          const request = store.get("userSettings");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        console.log("📦 Raw load result from DB:", result);

        if (result?.data) {
          selectedState.settings = result.data;
          console.log("✅ Loaded settings from DB:", selectedState.settings);
        } else {
          selectedState.settings = getDefaultPlatformSettings();
          console.log("ℹ️ No saved settings found, using defaults:", selectedState.settings);
        }
      } catch (err) {
        console.error("❌ Error loading platform settings:", err);
      }
    }

    // ——— Function to save platform settings ———
    async function savePlatformSettings(settings) {
        const db = await getDB();
        const tx = db.transaction(STORE_SETTINGS, "readwrite");
        const store = tx.objectStore(STORE_SETTINGS);
        await store.put({ id: "userSettings", data: settings });
        console.log("💾 Saved platform settings:", settings);
        showToast('Settings saved');
        return tx.complete;
    }

    // ——— Platform Default settings ———
    function getDefaultPlatformSettings() {
      return {
        // Notes:
        // Instagram: 40 chars is best for "before the fold" caption prior to the 'more' button because
        // the additional hashtags will cause the 'more' button to always show up -- I am seeing it
        // show up mostly on the 1st line in the normal feed (2nd line if viewing from my profile)
        // and if accounting for the 'more' button on the 1st line and the chars count in my handle, that
        // only allows about 40 more chars visually before it gets cut off
        //
        // TikTok: 70 chars is best for "before the fold" caption prior to the 'more' button because
        // the additional hashtags will cause the 'more' button to always show up -- The handle is above
        // the caption so those chars don't need to be included
        //
        // Facebook: 50 chars is best because it tests the best for reach -- We will also use only two
        // hashtags and so everything will fit on 2 or 3 lines, avoiding the more button altogether
        //
        // Threads: 80 chars is best because there's no good data, so we will match it to Twitter -- We
        // will have 3 hashtags and they all will be visible
        //
        // Twitter: 80 chars is best because it tests the best for reach -- We will use only 2 hashtags
        // and everything will be visible
        //
        // Bluesky: 80 chars is best because there's no good data, so we will match it to Twitter -- We
        // will have 5 hashtags and they all will be visible
        //
        // Spoutible: 80 chars is best because there's no good data, so we will match it to Twitter -- We
        // will have 3 hashtags and they all will be visible
        Instagram: { chars: 40, niche: 5, popular: 3, branded: 1 },
        TikTok:    { chars: 70, niche: 3, popular: 2, branded: 1 },
        Facebook:  { chars: 50,  niche: 2, popular: 0, branded: 0 },
        Threads:   { chars: 80, niche: 2, popular: 0, branded: 1 },
        Twitter:   { chars: 80,  niche: 1, popular: 1, branded: 0 },
        Bluesky:   { chars: 80, niche: 2, popular: 2, branded: 1 },
        Spoutible: { chars: 80, niche: 2, popular: 0, branded: 1 }
      };
    }

    // ——— Function to fetch the information from Google Sheets ———
    async function fetchSheet(sheetName) {
      const url  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
      const res  = await fetch(url);
      const text = await res.text();
      const json = JSON.parse(text.substring(47).slice(0, -2));

      // Map column‐letters to our property names:
      const keyMap = sheetName === SHEET_NAME_CAPTIONS
        ? { A: 'Caption',  B: 'Identifiers',   C: 'Platforms',   D: 'Char Total' }
        : { A: 'Hashtag',  B: 'Identifiers',   C: 'Platforms',   D: 'Type' };

      // Grab the column letters in order:
      const cols = json.table.cols.map(c => c.id); // e.g. ['A','B','C','D', ...]

      // Look at the very first row’s first cell:
      const allRows     = json.table.rows;
      const firstCell   = allRows[0].c[0]?.v ?? '';
      const expectedHdr = keyMap[cols[0]];        // 'Caption' or 'Hashtag'

      // If the first cell matches our header label, drop it
      const dataRows = firstCell === expectedHdr
        ? allRows.slice(1)
        : allRows;

      return dataRows.map(r => {
        // We’ll ignore the sheet’s own row‑number index and let IndexedDB auto‑key
        const obj = {};

        r.c.forEach((cell, i) => {
          const key = keyMap[cols[i]];
          if (key) obj[key] = cell?.v ?? '';
        });

        return obj;
      });
    }

    // ——— Syncing call that initiaye the fetch from Google Sheets for each bank ———
    async function syncFromGoogleSheets() {
        try {
            showToast('Syncing from Google Sheets…');
            const [captions, hashtags] = await Promise.all([
                fetchSheet(SHEET_NAME_CAPTIONS),
                fetchSheet(SHEET_NAME_HASHTAGS),
            ]);

            const db = await getDB();

            // Clear + add captions
            {
                let tx1 = db.transaction(STORE_CAPTIONS, 'readwrite');
                let store1 = tx1.objectStore(STORE_CAPTIONS);
                store1.clear();
                captions.forEach(item => {
                    delete item.id; // Remove id to ensure fresh auto-increment
                    store1.add(item);
                });
                await tx1.complete;
            }

            // Clear + add hashtags
            {
                let tx2 = db.transaction(STORE_HASHTAGS, 'readwrite');
                let store2 = tx2.objectStore(STORE_HASHTAGS);
                store2.clear();
                hashtags.forEach(item => {
                    delete item.id;
                    store2.add(item);
                });
                await tx2.complete;
            }

            showToast('Sync successful');

            // Reload in-memory data for captions and hashtags after a successful sync
            selectedState.captions = await getAllFromIndexedDB(STORE_CAPTIONS);
            selectedState.hashtags = await getAllFromIndexedDB(STORE_HASHTAGS);

        } catch(err) {
            console.error('Sync failed:', err);
            showToast('Sync failed', true);
        }
    }

    // ——— Function write new data to Google Sheets for each bank ———
    async function sendToGoogleSheets(dataArray, sheetName) {
      const url = SHEET_WRITE_URL;

      for (const item of dataArray) {
        const formData = new FormData();
        formData.append('sheetName', sheetName);

        // Append all key-value pairs from the object
        for (const [key, value] of Object.entries(item)) {
          formData.append(key, value);
        }

        try {
          const response = await fetch(url, {
            method: 'POST',
            body: formData
          });

          const result = await response.json();

          if (!response.ok || result.status !== 'success') {
              console.error('❌ Failed to submit to Google Sheets:', result);
          } else {
              console.log('✅ Submitted to Google Sheets:', item);
          }
        } catch (err) {
          console.error('❌ Error submitting to Google Sheets:', err);
        }
      }
    }

    // ——— Initialize Platform Settings ———
    function initializeSettings() {
        platforms.forEach(platform => {
            const settings = selectedState.settings[platform];

            // Create platform settings card
            const card = document.createElement('div');
            card.classList.add('platform-card');
            card.innerHTML = `
                <h3>${platform}</h3>
                <div class="setting">
                    <label for="${platform}-chars">Max Caption Chars:</label>
                    <input type="number" id="${platform}-chars" data-platform="${platform}" data-setting="chars" value="${selectedState.settings[platform].chars}" min="0">
                </div>
                <div class="setting">
                    <label for="${platform}-niche">Niche Hashtags:</label>
                    <input type="number" id="${platform}-niche" data-platform="${platform}" data-setting="niche" value="${selectedState.settings[platform].niche}" min="0">
                </div>
                <div class="setting">
                    <label for="${platform}-popular">Popular Hashtags:</label>
                    <input type="number" id="${platform}-popular" data-platform="${platform}" data-setting="popular" value="${selectedState.settings[platform].popular}" min="0">
                </div>
                <div class="setting">
                    <label for="${platform}-branded">Branded Hashtags:</label>
                    <input type="number" id="${platform}-branded" data-platform="${platform}" data-setting="branded" value="${selectedState.settings[platform].branded}" min="0">
                </div>

                <div class="setting total-setting">
                    <label>Total Hashtags:</label>
                    <span id="${platform}-total">${selectedState.settings[platform].niche + selectedState.settings[platform].popular + selectedState.settings[platform].branded}</span>
                </div>
            `;
            platformSettingsContainer.appendChild(card);

            // Create platform exclusion checkbox
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.classList.add('platform-checkbox-wrapper');
            const checkboxId = `exclude-${platform}`;
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="${checkboxId}" data-platform="${platform}">
                <label for="${checkboxId}">${platform}</label>
            `;
            platformExclusionsContainer.appendChild(checkboxWrapper);
        });
    }

    // ——— Function to update total hashtag count when user updates specific hashtag amount in platform settings ———
    function updateTotalHashtags(platform) {
        const niche = parseInt(document.getElementById(`${platform}-niche`).value) || 0;
        const popular = parseInt(document.getElementById(`${platform}-popular`).value) || 0;
        const branded = parseInt(document.getElementById(`${platform}-branded`).value) || 0;
        const total = niche + popular + branded;
        document.getElementById(`${platform}-total`).textContent = total;
    }

    // ——— Function to get accurate character count for captions that include emojis ———
    function getAccurateCharacterCount(str) {
        if (typeof Intl === 'undefined' || !Intl.Segmenter) {
            throw new Error('Intl.Segmenter is not supported in this environment.');
        }

        const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
        const graphemes = Array.from(segmenter.segment(str));
        return graphemes.length;
    }

    // --- Modal Functionality ---
    function openModal(modalOverlay) {
        modalOverlay.classList.add('modal-open');
        document.body.classList.add('modal-open'); // Prevent background scroll
    }

    function closeModal(modalOverlay) {
        modalOverlay.classList.remove('modal-open');
        // Only remove body class if no other modals are open
        if (!document.querySelector('.modal-overlay.modal-open')) {
            document.body.classList.remove('modal-open');
        }
    }

    function resetAddCaptionsModal() {
        addCaptionState.category = null;
        addCaptionState.platforms.clear();

        addCaptionsCategoryBtns.querySelectorAll('.category-btn.active').forEach(btn => btn.classList.remove('active'));
        addCaptionsPlatformBtns.querySelectorAll('.platform-btn.active').forEach(btn => btn.classList.remove('active'));

        const allInputs = addCaptionsInputArea.querySelectorAll('.caption-input-wrapper');
        allInputs.forEach((wrapper, index) => {
            if (index === 0) {
                wrapper.querySelector('.caption-input').value = '';
            } else {
                wrapper.remove();
            }
        });
        const firstRemoveBtn = addCaptionsInputArea.querySelector('.caption-input-wrapper:first-child .remove-caption-btn');
        if(firstRemoveBtn) firstRemoveBtn.style.display = 'none';
    }

    function resetAddHashtagsModal() {
        addHashtagState.categories.clear();
        addHashtagState.tags.clear();
        addHashtagState.platforms.clear();
        addHashtagState.type = null;

        addHashtagsCategoryBtns.querySelectorAll('.category-btn.active').forEach(btn => btn.classList.remove('active'));
        addHashtagsTagsBtns.querySelectorAll('.tag-btn.active').forEach(btn => btn.classList.remove('active'));
        addHashtagsPlatformBtns.querySelectorAll('.platform-btn.active').forEach(btn => btn.classList.remove('active'));
        addHashtagsTypeBtns.querySelectorAll('.type-btn.active').forEach(btn => btn.classList.remove('active'));
        addHashtagsInput.value = '';
    }

    // Close modal when clicking overlay background
    [captionsModalOverlay, hashtagsModalOverlay, addCaptionsModalOverlay, addHashtagsModalOverlay].forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeModal(overlay);
            }
        });
    });

    // Close modal buttons
    closeCaptionsModalBtn.addEventListener('click', () => closeModal(captionsModalOverlay));
    closeHashtagsModalBtn.addEventListener('click', () => closeModal(hashtagsModalOverlay));
    closeAddCaptionsModalBtn.addEventListener('click', () => closeModal(addCaptionsModalOverlay));
    closeAddHashtagsModalBtn.addEventListener('click', () => closeModal(addHashtagsModalOverlay));

    // --- Event Listeners ---

    // Collapsible Section Toggle
    platformSettingsHeader.addEventListener('click', () => {
      // If the click target is the reset button or inside it, do NOT toggle
      if (event.target.closest('#reset-settings-btn')) {
          return;
      }

      platformSettingsSection.classList.toggle('expanded');
    });

    customHashtagsHeader.addEventListener('click', () => {
        customHashtagsSection.classList.toggle('expanded');
    });

    // Category Selection (Single Choice)
    mainCategoriesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-btn')) {
            // Remove active class from all category buttons
            mainCategoriesContainer.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            event.target.classList.add('active');
            selectedState.category = event.target.dataset.category;
            console.log("Selected category:", selectedState.category);
        }
    });

    // Tag Selection (Multiple Choice)
    additionalTagsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('tag-btn')) {
            const tag = event.target.dataset.tag;
            event.target.classList.toggle('active');
            if (event.target.classList.contains('active')) {
                selectedState.tags.add(tag);
            } else {
                selectedState.tags.delete(tag);
            }
            console.log("Selected tags:", Array.from(selectedState.tags));
        }
    });

    // Settings Input Change
    platformSettingsContainer.addEventListener('input', (event) => {
        if (event.target.tagName === 'INPUT' && event.target.type === 'number') {
            const platform = event.target.dataset.platform;
            const setting = event.target.dataset.setting;
            const value = parseInt(event.target.value, 10);

            if (platform && setting && !isNaN(value)) {
                selectedState.settings[platform][setting] = value >= 0 ? value : 0; // Ensure non-negative
                // Optionally update the input value if it was negative
                if (value < 0) event.target.value = 0;
                console.log("Updated settings:", selectedState.settings);

                // Update total hashtag count
                updateTotalHashtags(platform);

                // Save updated platform settings to indexedDB
                savePlatformSettings(selectedState.settings);
            }
        }
    });

    // Custom Hashtags Input Change
    customHashtagsInput.addEventListener('input', (event) => {
        selectedState.customHashtags = event.target.value.trim();
        console.log("Updated custom hashtags:", selectedState.customHashtags);
    });

    // Platform Exclusion Checkbox Change
    platformExclusionsContainer.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const platform = event.target.dataset.platform;
            if (event.target.checked) {
                selectedState.excludeCustomHashtags.add(platform);
            } else {
                selectedState.excludeCustomHashtags.delete(platform);
            }
            console.log("Excluded platforms for custom hashtags:", Array.from(selectedState.excludeCustomHashtags));
        }
    });

    // Generate Button Click
    generateBtn.addEventListener('click', () => {
        console.log("Generate button clicked!");
        console.log("Current State:", selectedState);

        // **Placeholder Generation Logic**
        outputArea.innerHTML = ''; // Clear previous results
        outputArea.classList.add('output-grid'); // Ensure grid class is present

        if (!selectedState.category) {
            outputArea.innerHTML = '<p class="placeholder-text" style="color: red;">Please select a main category.</p>';
            outputArea.classList.remove('output-grid'); // Remove grid if only error message
            return;
        }

        platforms.forEach(platform => {
            const settings = selectedState.settings[platform];
            const totalHashtags = settings.niche + settings.popular + settings.branded;

            // Get random caption logic
            const captionEntry = getFilteredCaptionForPlatform(platform, settings, selectedState);
            const captionText = captionEntry
                ? captionEntry.Caption
                : `⚠️ No matching caption found for ${selectedState.category} under ${settings.chars} characters for ${platform}`;

            // Get random caption logic
            const hashtagData = getFilteredHashtagsForPlatform(platform, settings, selectedState);
            let hashtagList = [
                ...hashtagData.niche,
                ...hashtagData.popular,
                ...hashtagData.branded
            ];

            // Apply custom formatting per platform
            let hashtags = '';
            console.log("Platform: ", platform);

            switch (platform) {
                case 'Instagram':
                    // Use middle dot to create two new lines to separate caption from hashtags -- No need
                    // to use a hashtag separator because hashtags are hidden behind 'more' button
                    hashtags = `·\n·\n${hashtagList.join(' ')}`;
                    break;
                case 'TikTok':
                    // // Use a blank space between caption and hashtags, a 'more' button will show becuase of
                    // the char count when including hashtags but the hashtags will be hidden by the 'more'
                    // button -- However, the extra row should ensure the hashtags don't show on short captions
                    hashtags = `\n${hashtagList.join(' ')}`;
                    break;
                case 'Facebook':
                    // Don't use a line break and that should prevent the 'more' button from showing up, which
                    // also means hashtags will show -- Use the middle dot as a hashtag separator
                    hashtags = hashtagList.join(' · ');
                    break;
                case 'Threads':
                    // Use a blank space between caption and topics -- A 'more' button  will not appear so
                    // topcis will show -- Use the middle dot as a topic separator -- Because hastags are
                    // not really used, remove the '#' symbol and turn hashtags into words with spaces
                    const formattedTopics = hashtagList
                        .slice(0, 3) // Only 3 total: 2 + 1 branded
                        .map(tag =>
                            tag
                            .replace(/^#/, '') // remove leading '#'
                            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ARCanvas → AR Canvas
                            .replace(/([a-z])([A-Z])/g, '$1 $2')       // augmentedReality → augmented Reality
                        )
                        .join(' · ');

                    hashtags = `\n${formattedTopics}`;
                    break;
                case 'Twitter':
                    // Use a blank space between caption and hashtag -- A 'more' button  will not appear so
                    // hashtags will show -- Use the middle dot as a hashtag separator
                    hashtags = `\n${hashtagList.join(' · ')}`;
                    break;
                case 'Bluesky':
                    // Use a blank space between caption and hashtag -- A 'more' button  will not appear so
                    // hashtags will show -- Use the middle dot as a hashtag separator -- Also character limit
                    // on a line is around 40, so we when the char total of hashtag line goes over 40, we will
                    // move that last hahstag to a new line and not remove the middle dot separator before that one
                    hashtags = '\n' + formatWrappedHashtags(hashtagList, 40);
                    break;
                case 'Spoutible':
                    // Use a blank space between caption and hashtag -- A 'more' button  will not appear so
                    // hashtags will show -- Use the middle dot as a hashtag separator -- Also character limit
                    // on a line is around 50, so we when the char total of hashtag line goes over 50, we will
                    // move that last hahstag to a new line and not remove the middle dot separator before that one
                    hashtags = '\n' + formatWrappedHashtags(hashtagList, 50);
                    break;
                default:
                    hashtags = hashtagList.join(' ');
            }

            // Optional: append warning if exists
            if (hashtagData.warning) {
                hashtags += `\n${hashtagData.warning}`;
            }

            // Combine caption plus hashtags into one full caption output
            const captionFullOutput = `${captionText}\n${hashtags}`;

            const platformOutput = document.createElement('div');
            platformOutput.classList.add('output-platform');

            platformOutput.innerHTML = `
                <h4>
                    ${platform}
                    <button class="copy-btn" data-platform="${platform}" title="Copy Caption & Hashtags">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span class="copy-text">Copy</span>
                    </button>
                </h4>
                <div class="output-content">
                    <div class="output-caption" id="caption-${platform}">${captionFullOutput}</div>
                </div>
            `;
            outputArea.appendChild(platformOutput);
        });
        // Add copy functionality after generating content
        addCopyButtonListeners();
    });

    // ——— Function to wrap hashtags to a new line when max line length is reached ———
    function formatWrappedHashtags(hashtags, maxLineLength) {
        const lines = [];
        let currentLine = '';

        hashtags.forEach((tag, index) => {
            const formattedTag = (currentLine.length === 0) ? tag : ` · ${tag}`;

            if ((currentLine + formattedTag).length <= maxLineLength) {
                currentLine += formattedTag;
            } else {
                // Push current line to result, start new one with no leading dot
                if (currentLine) lines.push(currentLine);
                currentLine = tag;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines.join('\n');
    }

    // ——— Function to get a random caption for intended platform that matches filters and platform settings  ———
    function getFilteredCaptionForPlatform(platform, settings, state) {
      const targetCategory = state.category?.toLowerCase();
      const maxChars = settings.chars;

      // The following is for debugging
      // console.log(`🔍 Filtering captions for: ${platform}`);
      // console.log(`➡️ Required category: "${targetCategory}", max chars: ${maxChars}`);

      const matches = state.captions.filter(caption => {
        const rawCaption = caption.Caption;
        const identifiers = caption.Identifiers?.split(',').map(s => s.trim().toLowerCase()) || [];
        const platforms = caption.Platforms?.split(',').map(s => s.trim().toLowerCase()) || [];
        const charCount = parseInt(caption['Char Total'], 10);

        const matchesIdentifier = identifiers.some(tag => tag.toLowerCase() === targetCategory?.toLowerCase());
        const matchesPlatform = platforms.some(p => p.toLowerCase() === platform.toLowerCase()) || platforms.map(p => p.toLowerCase()).includes('all');
        const withinCharLimit = !isNaN(charCount) && charCount <= maxChars;

        // Only for debgugging: Log info for each caption considered
        // console.log(`— Caption: "${rawCaption}"`);
        // console.log(`   Identifiers:`, identifiers);
        // console.log(`   Platforms:`, platforms);
        // console.log(`   Char count:`, charCount);
        // console.log(`   ✅ Category Match: ${matchesIdentifier}, Platform Match: ${matchesPlatform}, Char Limit: ${withinCharLimit}`);

        return matchesIdentifier && matchesPlatform && withinCharLimit;
      });

      if (matches.length === 0) {
        console.warn(`⚠️ No caption found for ${platform}`);
        return null; // return null to indicate no match
      }

      const chosen = matches[Math.floor(Math.random() * matches.length)];
      console.log(`✅ Selected caption for ${platform}:`, chosen);
      return chosen; // return full object
    }

   // ——— Function to get a random caption for intended platform that matches filters and platform settings  ———
    function getFilteredCaptionForPlatform(platform, settings, state) {
      const targetCategory = state.category?.toLowerCase();
      const maxChars = settings.chars;

      // The following is for debugging
      // console.log(`🔍 Filtering captions for: ${platform}`);
      // console.log(`➡️ Required category: "${targetCategory}", max chars: ${maxChars}`);

      const matches = state.captions.filter(caption => {
        const rawCaption = caption.Caption;
        const identifiers = caption.Identifiers?.split(',').map(s => s.trim().toLowerCase()) || [];
        const platforms = caption.Platforms?.split(',').map(s => s.trim().toLowerCase()) || [];
        const charCount = parseInt(caption['Char Total'], 10);

        const matchesIdentifier = identifiers.some(tag => tag.toLowerCase() === targetCategory?.toLowerCase());
        const matchesPlatform = platforms.some(p => p.toLowerCase() === platform.toLowerCase()) || platforms.map(p => p.toLowerCase()).includes('all');
        const withinCharLimit = !isNaN(charCount) && charCount <= maxChars;

        // Only for debgugging: Log info for each caption considered
        // console.log(`— Caption: "${rawCaption}"`);
        // console.log(`   Identifiers:`, identifiers);
        // console.log(`   Platforms:`, platforms);
        // console.log(`   Char count:`, charCount);
        // console.log(`   ✅ Category Match: ${matchesIdentifier}, Platform Match: ${matchesPlatform}, Char Limit: ${withinCharLimit}`);

        return matchesIdentifier && matchesPlatform && withinCharLimit;
      });

      if (matches.length === 0) {
        console.warn(`⚠️ No caption found for ${platform}`);
        return null; // return null to indicate no match
      }

      const chosen = matches[Math.floor(Math.random() * matches.length)];
      console.log(`✅ Selected caption for ${platform}:`, chosen);
      return chosen; // return full object
    }

    // ——— Function to get a random hashtags for intended platform that matches filters and platform settings  ———
    function getFilteredHashtagsForPlatform(platform, settings, state) {
        const platformLower = platform.toLowerCase();
        const category = state.category?.toLowerCase();
        const tags = Array.from(state.tags).map(tag => tag.toLowerCase());

        const result = {
            niche: [],
            popular: [],
            branded: [],
            warning: null
        };

        // --- 1. Parse and add custom hashtags if not excluded ---
        const customAllowed = !state.excludeCustomHashtags.has(platform);
        const customTags = customAllowed && state.customHashtags
            ? state.customHashtags
                .split(/[\s,]+/)
                .filter(tag => tag.length > 0)
                .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
            : [];

        // Fill niche with custom first
        const nicheTarget = settings.niche;
        result.niche = customTags.slice(0, nicheTarget);
        const neededNiche = nicheTarget - result.niche.length;

        // --- 2. Define filtering helper ---
        function matches(entry) {
            const idents = entry.Identifiers?.split(',').map(s => s.trim().toLowerCase()) || [];
            const plats  = entry.Platforms?.split(',').map(s => s.trim().toLowerCase()) || [];
            const matchesPlatform = plats.includes(platformLower) || plats.includes("all");
            const matchesCategory = idents.includes("all") || idents.includes(category);
            const matchesTags     = idents.includes("all") || tags.some(tag => idents.includes(tag));
            return matchesPlatform && (matchesCategory || matchesTags);
        }

        // --- 3. Separate eligible hashtags by type ---
        const eligible = state.hashtags.filter(matches);
        const nichePool   = eligible.filter(h => h.Type === 'Niche'   && !result.niche.includes(h.Hashtag));
        const popularPool = eligible.filter(h => h.Type === 'Popular');
        const brandedPool = eligible.filter(h => h.Type === 'Branded');

        // --- 4. Helper to randomly select without duplicates ---
        function pickRandom(arr, count) {
            const copy = [...arr];
            const picks = [];
            while (picks.length < count && copy.length > 0) {
                const i = Math.floor(Math.random() * copy.length);
                picks.push(copy.splice(i, 1)[0].Hashtag);
            }
            return picks;
        }

        // --- 5. Fill in niche hashtags ---
        // Fill in remaining niche slots, if any left, by prioritizing one category-related niche hashtag
        // first, and then a mix of both category-related and additional-tag-related hashtags
        let extraNeeded = neededNiche;

        // For debugging, to help check slots being filled
        //console.log(`🧮 Niche target: ${settings.niche}`);
        //console.log(`🔧 Custom hashtags filled: ${result.niche.length}`);
        //console.log(`🕳️ Niche slots remaining after custom: ${extraNeeded}`);

        // Step 1: Prioritize one niche slot from category-based identifiers
        const categoryNichePool = nichePool.filter(h =>
            h.Identifiers?.toLowerCase().split(',').map(s => s.trim()).includes(category)
        );

        if (extraNeeded > 0 && categoryNichePool.length > 0) {
            result.niche.push(...pickRandom(categoryNichePool, 1));
            extraNeeded -= 1;

            // For debugging, to confirm category-based hashtag is being filled 
            //console.log(`🎯 Filled 1 niche slot from category-based hashtags:`);
        }

        // Step 2: Fill remaining niche slots left from full pool, excluding one we may have just added
        const remainingPool = nichePool.filter(h => !result.niche.includes(h.Hashtag));
        result.niche.push(...pickRandom(remainingPool, extraNeeded));

        // --- 6. Fill in remainin popular and branded hashtags ---
        result.popular = pickRandom(popularPool, settings.popular);
        result.branded = pickRandom(brandedPool, settings.branded);

        // --- 7. Final warnings if underfilled ---
        const totalNiche = result.niche.length;
        const totalPop   = result.popular.length;
        const totalBrand = result.branded.length;

        const missing = [];
        if (totalNiche < settings.niche) {
            missing.push(`${settings.niche - totalNiche} niche`);
        }
        if (totalPop < settings.popular) {
            missing.push(`${settings.popular - totalPop} popular`);
        }
        if (totalBrand < settings.branded) {
            missing.push(`${settings.branded - totalBrand} branded`);
        }

        if (missing.length > 0) {
            result.warning = `⚠️ Not enough ${platform} hashtags:\nMissing ${missing.join(', ')}`;
            console.warn(result.warning);
        }
        return result;
    }

    // Add Copy Button Listeners Function
    function addCopyButtonListeners() {
        outputArea.querySelectorAll('.copy-btn').forEach(button => {
            // Remove any existing listener to prevent duplicates if regenerate is clicked
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', (event) => {
                const currentButton = event.currentTarget; // Use currentTarget
                const platform = currentButton.dataset.platform;
                const captionElement = document.getElementById(`caption-${platform}`);
                //const hashtagsElement = document.getElementById(`hashtags-${platform}`);
                const copyTextElement = currentButton.querySelector('.copy-text');
                const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;


                if (captionElement && copyTextElement) {
                    const captionText = captionElement.innerText;

                    navigator.clipboard.writeText(captionText)
                        .then(() => {
                            console.log(`${platform} content copied to clipboard!`);
                            // Provide visual feedback using class and icon change
                            currentButton.classList.add('copied');
                            currentButton.innerHTML = `${checkIconSVG} <span class="copy-text">Copied!</span>`;


                            setTimeout(() => {
                                currentButton.classList.remove('copied');
                                currentButton.innerHTML = `${copyIconSVG} <span class="copy-text">Copy</span>`;
                            }, 2000);
                        })
                        .catch(err => {
                            console.error('Failed to copy text: ', err);
                            alert('Failed to copy content. Please copy manually.');
                        });
                }
            });
        });
    }

    document.getElementById('reset-settings-btn').addEventListener('click', () => {
        selectedState.settings = getDefaultPlatformSettings();

        platforms.forEach(platform => {
            const settings = selectedState.settings[platform];
            document.getElementById(`${platform}-chars`).value = settings.chars;
            document.getElementById(`${platform}-niche`).value = settings.niche;
            document.getElementById(`${platform}-popular`).value = settings.popular;
            document.getElementById(`${platform}-branded`).value = settings.branded;
            document.getElementById(`${platform}-total`).textContent =
            settings.niche + settings.popular + settings.branded;
        });

        savePlatformSettings(selectedState.settings);
        console.log("🔄 Reset to default platform settings.");
    });

    document.getElementById('reset-settings-btn-mobile').addEventListener('click', () => {
        selectedState.settings = getDefaultPlatformSettings();

        platforms.forEach(platform => {
            const settings = selectedState.settings[platform];
            document.getElementById(`${platform}-chars`).value = settings.chars;
            document.getElementById(`${platform}-niche`).value = settings.niche;
            document.getElementById(`${platform}-popular`).value = settings.popular;
            document.getElementById(`${platform}-branded`).value = settings.branded;
            document.getElementById(`${platform}-total`).textContent =
            settings.niche + settings.popular + settings.branded;
        });

        savePlatformSettings(selectedState.settings);
        console.log("🔄 Reset to default platform settings.");
    });

    viewCaptionsBtn.addEventListener('click', () => {
        console.log("View Captions Bank clicked");
        window.captionsData = selectedState.captions.map(item => ({
            caption: item.Caption,
            identifiers: item.Identifiers?.split(',').map(s => s.trim()) || [],
            platforms: item.Platforms?.split(',').map(s => s.trim()) || [],
            charTotal: parseInt(item['Char Total'], 10) || item.caption?.length || 0
        }));
        populateCaptionFilters(); // Populate filters
        filterCaptions(); // Render initial full table
        openModal(captionsModalOverlay);
    });

    viewHashtagsBtn.addEventListener('click', () => {
        console.log("View Hashtags Bank clicked");
        window.hashtagsData = selectedState.hashtags.map(item => ({
            hashtag: item.Hashtag,
            identifiers: item.Identifiers?.split(',').map(s => s.trim()) || [],
            platforms: item.Platforms?.split(',').map(s => s.trim()) || [],
            type: item.Type || ''
        }));
        populateHashtagFilters(); // Populate filters first
        filterHashtags(); // Render initial full table
        openModal(hashtagsModalOverlay);
    });

    // --- Caption Modal Logic ---

    // Function to populate caption filter dropdowns
    function populateCaptionFilters() {
        const identifiers = new Set();
        const platformsSet = new Set();

        window.captionsData.forEach(item => {
            item.identifiers.forEach(id => identifiers.add(id));
            if (Array.isArray(item.platforms)) {
                item.platforms.forEach(p => platformsSet.add(p));
            }
        });

        // Populate Identifier Filter
        filterCaptionIdentifierSelect.innerHTML = '<option value="allIdentifiers">All Identifiers</option>';
        [...identifiers].sort().forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            filterCaptionIdentifierSelect.appendChild(option);
        });

        // Populate Platform Filter
        filterCaptionPlatformSelect.innerHTML = '<option value="allPlatforms">All Platforms</option>';
        [...platformsSet].sort().forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            filterCaptionPlatformSelect.appendChild(option);
        });

        // Reset Char Total filter input
        filterCaptionCharTotalInput.value = '';
    }

    // Function to render captions in the table
    function renderCaptionsTable(filteredData) {
        captionsTableBody.innerHTML = ''; // Clear existing rows

        if (filteredData.length === 0) {
            captionsTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No captions match the current filters.</td></tr>';
            return;
        }

        filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="col-caption">${item.caption}</td>
                <td class="col-identifiers">${item.identifiers.join(', ')}</td>
                <td class="col-platforms">${Array.isArray(item.platforms) ? item.platforms.join(', ') : item.platforms}</td>
                <td class="col-char-total">${item.charTotal}</td>
            `;
            captionsTableBody.appendChild(row);
        });
    }

    // Function to filter caption data
    function filterCaptions() {
        const selectedIdentifier = filterCaptionIdentifierSelect.value;
        const selectedPlatform = filterCaptionPlatformSelect.value;

        const maxCharsValue = filterCaptionCharTotalInput.value.trim();
        const maxChars = maxCharsValue === '' ? Infinity : parseInt(maxCharsValue, 10);

        // Handle invalid number input for chars (though min="0" helps)
        const charLimit = isNaN(maxChars) || maxChars < 0 ? Infinity : maxChars;

        const filtered = (window.captionsData || []).filter(item => {

            const identifiers = item.identifiers.map(id => id.toLowerCase());
            const platforms = item.platforms.map(p => p.toLowerCase());
            const selectedId = filterCaptionIdentifierSelect.value.toLowerCase();
            const selectedPlat = filterCaptionPlatformSelect.value.toLowerCase();

            const identifierMatch =
              selectedId === 'allidentifiers' ||
              identifiers.includes(selectedId) ||
              identifiers.includes('all');

              const platformMatch =
                selectedPlat === 'allplatforms' ||
                platforms.includes(selectedPlat) ||
                platforms.includes('all');

            const charTotalMatch = item.charTotal <= charLimit;

            return identifierMatch && platformMatch && charTotalMatch;
        });

        renderCaptionsTable(filtered);
    }

    // Add event listeners to caption filter dropdowns/input
    filterCaptionIdentifierSelect.addEventListener('change', filterCaptions);
    filterCaptionPlatformSelect.addEventListener('change', filterCaptions);
    filterCaptionCharTotalInput.addEventListener('input', filterCaptions); // Use input for immediate feedback

    // --- Hashtag Modal Logic ---

    // Function to populate filter dropdowns
    function populateHashtagFilters() {
        const identifiers = new Set();
        const platformsSet = new Set();
        const types = new Set();

        window.hashtagsData.forEach(item => {
            item.identifiers.forEach(id => identifiers.add(id));
            if (Array.isArray(item.platforms)) {
                item.platforms.forEach(p => platformsSet.add(p));
            }
            types.add(item.type);
        });

        // Populate Identifier Filter
        filterIdentifierSelect.innerHTML = '<option value="allIdentifiers">All Identifiers</option>';
        [...identifiers].sort().forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id;
            filterIdentifierSelect.appendChild(option);
        });

        // Populate Platform Filter
        filterPlatformSelect.innerHTML = '<option value="allPlatforms">All Platforms</option>';
        [...platformsSet].sort().forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            filterPlatformSelect.appendChild(option);
        });

        // Populate Type Filter
        filterTypeSelect.innerHTML = '<option value="all">All Types</option>'; // Reset
        [...types].sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            filterTypeSelect.appendChild(option);
        });
    }

    // Function to render hashtags in the table
    function renderHashtagsTable(filteredData) {
        hashtagsTableBody.innerHTML = ''; // Clear existing rows

        if (filteredData.length === 0) {
            hashtagsTableBody.innerHTML = '<tr><td colspan="4" class="no-results">No hashtags match the current filters.</td></tr>';
            return;
        }

        filteredData.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.hashtag}</td>
                <td>${item.identifiers.join(', ')}</td>
                <td>${Array.isArray(item.platforms) ? item.platforms.join(', ') : item.platforms}</td>
                <td>${item.type}</td>
            `;
            hashtagsTableBody.appendChild(row);
        });
    }

    // Function to filter hashtag data
    function filterHashtags() {
        const selectedIdentifier = filterIdentifierSelect.value;
        const selectedPlatform = filterPlatformSelect.value;
        const selectedType = filterTypeSelect.value;

        const filtered = (window.hashtagsData || []).filter(item => {

            const identifiers = item.identifiers.map(id => id.toLowerCase());
            const platforms = item.platforms.map(p => p.toLowerCase());
            const type = item.type?.toLowerCase() || '';

            const selectedId = filterIdentifierSelect.value.toLowerCase();
            const selectedPlat = filterPlatformSelect.value.toLowerCase();
            const selectedType = filterTypeSelect.value.toLowerCase();

            const identifierMatch =
              selectedId === 'allidentifiers' ||
              identifiers.includes(selectedId) ||
              identifiers.includes('all');

              const platformMatch =
                selectedPlat === 'allplatforms' ||
                platforms.includes(selectedPlat) ||
                platforms.includes('all');

            const typeMatch = selectedType === 'all' || type === selectedType;

            return identifierMatch && platformMatch && typeMatch;
        });

        renderHashtagsTable(filtered);
    }

    addCaptionBtn.addEventListener('click', () => {
        console.log("Add New Captions clicked - opening modal");
        resetAddCaptionsModal();
        openModal(addCaptionsModalOverlay);
    });

    addCaptionsCategoryBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-btn')) {
            addCaptionsCategoryBtns.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            addCaptionState.category = event.target.dataset.category;
            console.log("Add Caption - Selected category:", addCaptionState.category);
        }
    });

    addCaptionsPlatformBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('platform-btn')) {
            const platform = event.target.dataset.platform;
            const isActive = event.target.classList.toggle('active');
            const allButton = addCaptionsPlatformBtns.querySelector('.platform-btn[data-platform="All"]');

            if (platform === 'All') {
                if (isActive) {
                    addCaptionState.platforms.clear();
                    addCaptionState.platforms.add('All');
                    addCaptionsPlatformBtns.querySelectorAll('.platform-btn:not([data-platform="All"])').forEach(btn => {
                        btn.classList.remove('active');
                    });
                } else {
                    addCaptionState.platforms.delete('All');
                }
            } else {
                if (isActive) {
                    if (allButton.classList.contains('active')) {
                        allButton.classList.remove('active');
                        addCaptionState.platforms.delete('All');
                    }
                    addCaptionState.platforms.add(platform);
                } else {
                    addCaptionState.platforms.delete(platform);
                }
            }
            console.log("Add Caption - Selected platforms:", Array.from(addCaptionState.platforms));
        }
    });

    addAnotherCaptionBtn.addEventListener('click', () => {
        const newInputWrapper = document.createElement('div');
        newInputWrapper.classList.add('caption-input-wrapper');
        newInputWrapper.innerHTML = `
            <textarea class="caption-input" placeholder="Enter another caption..." rows="3"></textarea>
            <button class="remove-caption-btn" title="Remove Caption">&times;</button>
        `;
        addCaptionsInputArea.appendChild(newInputWrapper);

        newInputWrapper.querySelector('.remove-caption-btn').addEventListener('click', (e) => {
            e.target.closest('.caption-input-wrapper').remove();
        });
    });

    addCaptionsInputArea.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-caption-btn')) {
            if (event.target.closest('.caption-input-wrapper') !== addCaptionsInputArea.querySelector('.caption-input-wrapper:first-child')) {
                event.target.closest('.caption-input-wrapper').remove();
            }
        }
    });

    submitAddCaptionsBtn.addEventListener('click', async () => {
        const category = addCaptionState.category;
        const platformsSelected = Array.from(addCaptionState.platforms);
        const finalPlatforms = platformsSelected.includes('All') ? 'All' : platformsSelected;

        const captionInputs = addCaptionsInputArea.querySelectorAll('.caption-input');
        const newCaptions = [];

        if (!category) {
            alert('Please select a main category.');
            return;
        }
        if (platformsSelected.length === 0) {
            alert('Please select at least one platform (or "All").');
            return;
        }

        let hasValidCaption = false;
        captionInputs.forEach(input => {
            const captionText = input.value.trim();
            if (captionText) {
                hasValidCaption = true;
                const charTotal = getAccurateCharacterCount(captionText);
                newCaptions.push({
                    Caption: captionText,
                    Identifiers: category,
                    Platforms: Array.isArray(finalPlatforms) ? finalPlatforms.join(', ') : finalPlatforms,
                    'Char Total': charTotal
                });
            }
        });

        if (!hasValidCaption) {
            alert('Please enter at least one caption.');
            return;
        }

        // Add new captions to IndexedDB and update captions stored in web app's memory
        let indexedDBSuccess = false;
        try {
            await addToIndexedDB(STORE_CAPTIONS, newCaptions);
            console.log("✅ Captions updated in IndexedDB successfully");
            showToast(`${newCaptions.length} New Captions\nSuccessfully Added`);

            // Only update local state if IndexedDB was successful
            selectedState.captions = await getAllFromIndexedDB(STORE_CAPTIONS);
            console.log("🔄 selectedState.captions updated");
        } catch (err) {
            console.error("❌ Failed to update captions in IndexedDBs:", err);
            alert("Failed to add new captions locally.");
        }

        // Close the modal now so user can continue and then send to Google Sheets in the background
        closeModal(addCaptionsModalOverlay);

        // Update Google Sheets with new captions
        try {
            await sendToGoogleSheets(newCaptions, SHEET_NAME_CAPTIONS);
            console.log("✅ Captions updated in Google Sheets successfully");
        } catch (err) {
            console.error("❌ Failed to sync with Google Sheets for captions:", err);
            alert("Failed to add new captions to Google Sheets.");
        }
    });

    addHashtagBtn.addEventListener('click', () => {
        console.log("Add New Hashtags clicked - opening modal");
        resetAddHashtagsModal();
        openModal(addHashtagsModalOverlay);
    });

    addHashtagsCategoryBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('category-btn')) {
            const category = event.target.dataset.category;
            const isActive = event.target.classList.toggle('active');
            if (isActive) {
                addHashtagState.categories.add(category);
            } else {
                addHashtagState.categories.delete(category);
            }
            console.log("Add Hashtag - Selected categories:", Array.from(addHashtagState.categories));
        }
    });

    addHashtagsTagsBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('tag-btn')) {
            const tag = event.target.dataset.tag;
            const isActive = event.target.classList.toggle('active');
            const allButton = addHashtagsTagsBtns.querySelector('.tag-btn[data-tag="All"]');

            if (tag === 'All') {
                if (isActive) {
                    addHashtagState.tags.clear();
                    addHashtagState.tags.add('All');
                    addHashtagsTagsBtns.querySelectorAll('.tag-btn:not([data-tag="All"])').forEach(btn => {
                        btn.classList.remove('active');
                    });
                } else {
                    addHashtagState.tags.delete('All');
                }
            } else {
                if (isActive) {
                    if (allButton.classList.contains('active')) {
                        allButton.classList.remove('active');
                        addHashtagState.tags.delete('All');
                    }
                    addHashtagState.tags.add(tag);
                } else {
                    addHashtagState.tags.delete(tag);
                }
            }
            console.log("Add Hashtag - Selected tags:", Array.from(addHashtagState.tags));
        }
    });

    addHashtagsPlatformBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('platform-btn')) {
            const platform = event.target.dataset.platform;
            const isActive = event.target.classList.toggle('active');
            const allButton = addHashtagsPlatformBtns.querySelector('.platform-btn[data-platform="All"]');

            if (platform === 'All') {
                if (isActive) {
                    addHashtagState.platforms.clear();
                    addHashtagState.platforms.add('All');
                    addHashtagsPlatformBtns.querySelectorAll('.platform-btn:not([data-platform="All"])').forEach(btn => {
                        btn.classList.remove('active');
                    });
                } else {
                    addHashtagState.platforms.delete('All');
                }
            } else {
                if (isActive) {
                    if (allButton.classList.contains('active')) {
                        allButton.classList.remove('active');
                        addHashtagState.platforms.delete('All');
                    }
                    addHashtagState.platforms.add(platform);
                } else {
                    addHashtagState.platforms.delete(platform);
                }
            }
            console.log("Add Hashtag - Selected platforms:", Array.from(addHashtagState.platforms));
        }
    });

    addHashtagsTypeBtns.addEventListener('click', (event) => {
        if (event.target.classList.contains('type-btn')) {
            addHashtagsTypeBtns.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            addHashtagState.type = event.target.dataset.type;
            console.log("Add Hashtag - Selected type:", addHashtagState.type);
        }
    });

    submitAddHashtagsBtn.addEventListener('click', async () => {
        const categories = Array.from(addHashtagState.categories);
        const tags = Array.from(addHashtagState.tags);
        const platforms = Array.from(addHashtagState.platforms);
        const type = addHashtagState.type;
        const hashtagText = addHashtagsInput.value.trim();

        if (categories.length === 0) {
            alert('Please select at least one category.');
            return;
        }
        if (tags.length === 0 && !tags.includes('All')) {
            alert('Please select at least one tag or "All".');
            return;
        }
        if (platforms.length === 0 && !platforms.includes('All')) {
            alert('Please select at least one platform or "All".');
            return;
        }
        if (!type) {
            alert('Please select a hashtag type.');
            return;
        }
        if (hashtagText.length === 0) {
            alert('Please enter a hashtag.');
            return;
        }

        const cleanedHashtags = hashtagText
            .split(/[\s,]+/)                           // Split on space or comma
            .filter(h => h.trim())                    // Remove empty entries
            .map(h => h.startsWith('#') ? h : `#${h}`); // Ensure hashtag symbol

        const finalIdentifiers = categories.join(', ');
        const finalPlatforms = platforms.includes('All') ? 'All' : platforms.join(', ');

        // Build one entry per hashtag
        const newHashtags = cleanedHashtags.map(tag => ({
            Hashtag: tag,
            Identifiers: finalIdentifiers,
            Platforms: finalPlatforms,
            Type: type
        }));

        // // Add new hashtags to IndexedDB and update captions stored in web app's memory
        let indexedDBSuccess = false;
        try {
            await addToIndexedDB(STORE_HASHTAGS, newHashtags);
            console.log("✅ Hashtags updated in IndexedDB successfully");
            showToast(`${newHashtags.length} New Hashtags\nSuccessfully Added`);

            // Only update local state if IndexedDB was successful
            selectedState.hashtags = await getAllFromIndexedDB(STORE_HASHTAGS);
            console.log("🔄 selectedState.hashtags updated");
        } catch (err) {
            console.error("❌ Failed to update hashtags in IndexedDB:", err);
            alert("Failed to add new hashtags locally.");
        }

        // Close the modal now so user can continue and then send to Google Sheets in the background
        closeModal(addHashtagsModalOverlay);

        // Update Google Sheets with new hashtags
        try {
            await sendToGoogleSheets(newHashtags, SHEET_NAME_HASHTAGS);
            console.log("✅ Hashtags updated in Google Sheets successfully");
        } catch (err) {
            console.error("❌ Failed to sync with Google Sheets for hashtags:", err);
            alert("Failed to add new hashtags to Google Sheets.");
        }
    });

    // Add event listeners to filter dropdowns
    filterIdentifierSelect.addEventListener('change', filterHashtags);
    filterPlatformSelect.addEventListener('change', filterHashtags);
    filterTypeSelect.addEventListener('change', filterHashtags);

    // --- Initial Setup ---
    await loadPlatformSettings();

    // Get the current captions and hashtag data from the persistent IndexedDB to start
    selectedState.captions = await getAllFromIndexedDB(STORE_CAPTIONS);
    selectedState.hashtags = await getAllFromIndexedDB(STORE_HASHTAGS);

    // Initialize other settings and start Google Sheet sync
    initializeSettings();
    await syncFromGoogleSheets();

    // Ensure the settings section starts collapsed (remove if expanded class was added by default)
    platformSettingsSection.classList.remove('expanded');
    customHashtagsSection.classList.remove('expanded');
});
