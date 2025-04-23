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

    const platforms = ["Instagram", "TikTok", "Facebook", "Threads", "Twitter", "Bluesky", "Spoutible"];
    const selectedState = {
        category: null,
        tags: new Set(),
        settings: {},
        customHashtags: '',
        excludeCustomHashtags: new Set() // Add property for platform exclusions
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
            t.textContent = message;
            t.style.opacity = '0'; // Start hidden for fade-in

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
    const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbxfCKH07OQ7-X5HDqRpsyzKkTXEvG5AO2NTZKYs3TdYZAEu08hfO2Y8ZheggiIghcXM/exec";
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

        // Only for debguggin: Log info for each caption considered
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

        // --- 5. Fill in hashtags ---
        result.niche.push(...pickRandom(nichePool, neededNiche));
        result.popular = pickRandom(popularPool, settings.popular);
        result.branded = pickRandom(brandedPool, settings.branded);

        // --- 6. Final warnings if underfilled ---
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

    // Content Management Button Placeholders
    addCaptionBtn.addEventListener('click', () => {
        console.log("Add New Captions clicked");
        alert("Functionality to add new captions is not yet implemented.");
    });
    addHashtagBtn.addEventListener('click', () => {
        console.log("Add New Hashtags clicked");
        alert("Functionality to add new hashtags is not yet implemented.");
    });
    viewCaptionsBtn.addEventListener('click', () => {
        console.log("View Captions Bank clicked");
        alert("Functionality to view captions bank is not yet implemented.");
    });
    viewHashtagsBtn.addEventListener('click', () => {
        console.log("View Hashtags Bank clicked");
        alert("Functionality to view hashtags bank is not yet implemented.");
    });

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
