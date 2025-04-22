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

     // --- Google Sheets & IndexedDB Setup ---
    const SHEET_ID = "15121EMhmrUMDrdkcr9vbePnMGtI67ilEYICaoAkFiDM";
    const SHEET_NAME_CAPTIONS = 'CaptionBank';
    const SHEET_NAME_HASHTAGS = 'HashtagBank';
    const SHEET_WRITE_URL = "https://script.google.com/macros/s/AKfycbxfCKH07OQ7-X5HDqRpsyzKkTXEvG5AO2NTZKYs3TdYZAEu08hfO2Y8ZheggiIghcXM/exec";
    const DB_NAME = 'ARTeezCaptionHashtagGeneratorDB';
    const STORE_CAPTIONS = 'captions';
    const STORE_HASHTAGS = 'hashtags';
    const STORE_SETTINGS = 'platformSettings';

    // --- Initialize IndexedDB ---
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

    // --- Function to load platform settings ---
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

    // --- Function to save platform settings ---
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
        Instagram: { chars: 140, niche: 5, popular: 3, branded: 1 },
        TikTok:    { chars: 140, niche: 3, popular: 2, branded: 1 },
        Facebook:  { chars: 50,  niche: 2, popular: 0, branded: 0 },
        Threads:   { chars: 140, niche: 2, popular: 0, branded: 1 },
        Twitter:   { chars: 80,  niche: 1, popular: 1, branded: 0 },
        Bluesky:   { chars: 140, niche: 2, popular: 2, branded: 1 },
        Spoutible: { chars: 140, niche: 2, popular: 0, branded: 1 }
      };
    }

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

        } catch(err) {
            console.error('Sync failed:', err);
            showToast('Sync failed', true);
        }
    }

    // --- Initialize Platform Settings ---
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

            // Simple placeholder text
            const caption = `This is a sample ${selectedState.category} caption (${Array.from(selectedState.tags).join(', ') || 'no tags'}) for ${platform}. Max chars: ${settings.chars}.`;
            let hashtags = `#${selectedState.category.toLowerCase().replace(' ','')} `;
            hashtags += Array.from({length: settings.popular}, (_, i) => `#popular${i+1}`).join(' ');
            hashtags += Array.from({length: settings.niche}, (_, i) => `#niche${i+1}`).join(' ');
            hashtags += Array.from({length: settings.branded}, (_, i) => `#brand${i+1}`).join(' ');

            // Add custom hashtags if any provided AND if platform is not excluded
            if (selectedState.customHashtags && !selectedState.excludeCustomHashtags.has(platform)) {
                // Basic processing: split by space/comma, filter empty, ensure '#' prefix
                const customTags = selectedState.customHashtags
                    .split(/[\s,]+/) // Split by space or comma
                    .filter(tag => tag.length > 0)
                    .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
                    .join(' ');
                if (customTags.length > 0) {
                    hashtags += ` ${customTags}`;
                }
            }

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
                    <div class="output-caption" id="caption-${platform}">${caption.substring(0, settings.chars)}</div>
                    <div class="output-hashtags" id="hashtags-${platform}">${hashtags.trim()}</div>
                </div>
            `;
            outputArea.appendChild(platformOutput);
        });
        // Add copy functionality after generating content
        addCopyButtonListeners();
    });

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
                const hashtagsElement = document.getElementById(`hashtags-${platform}`);
                const copyTextElement = currentButton.querySelector('.copy-text');
                const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;


                if (captionElement && hashtagsElement && copyTextElement) {
                    const captionText = captionElement.innerText;
                    const hashtagsText = hashtagsElement.innerText;
                    const fullText = `${captionText}\n\n${hashtagsText}`;

                    navigator.clipboard.writeText(fullText)
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
    initializeSettings();
    await syncFromGoogleSheets();
    // Ensure the settings section starts collapsed (remove if expanded class was added by default)
    platformSettingsSection.classList.remove('expanded');
    customHashtagsSection.classList.remove('expanded');
});
