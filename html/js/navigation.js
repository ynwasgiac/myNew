// Navigation Module
const Navigation = {
    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    },

    toggleDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }
};

// Navigation Functions
function showDashboard() {
    hideAllViews();
    document.getElementById('dashboardView').classList.remove('hidden');
    updateActiveNavLink('dashboard');
    localStorage.setItem('last_view', 'dashboard');
}

function showCategories() {
    hideAllViews();
    document.getElementById('categoriesView').classList.remove('hidden');
    updateActiveNavLink('categories');
    localStorage.setItem('last_view', 'categories');
    loadCategories();
}

function showMyWords() {
    hideAllViews();
    document.getElementById('myWordsView').classList.remove('hidden');
    updateActiveNavLink('myWords');
    localStorage.setItem('last_view', 'myWords');
    loadMyWords();
}

function showPractice() {
    hideAllViews();
    document.getElementById('practiceView').classList.remove('hidden');
    updateActiveNavLink('practice');
    localStorage.setItem('last_view', 'practice');
}

function showSettings() {
    hideAllViews();
    document.getElementById('settingsView').classList.remove('hidden');
    updateActiveNavLink('settings');

    // Initialize settings if not done already
    if (Settings) {
        Settings.init();
    }
}

function showProfile() {
    showSettings();
    // Auto-switch to profile-like view (language tab shows profile info)
    setTimeout(() => {
        Settings.showTab('profile');
    }, 100);
}

function showLanguageSettings() {
    showSettings();
    setTimeout(() => {
        Settings.showTab('language');
    }, 100);
}

function showAllWords() {
    hideAllViews();
    document.getElementById('allWordsView').classList.remove('hidden');
    updateActiveNavLink('allWords');
    localStorage.setItem('last_view', 'allWords');
    loadAllWordsDifficultyLevels();
    loadAllWordsTypes();
    loadAllWordsCategories();
    loadAllWords();
}

function showAdminPanel() {
    hideAllViews();
    document.getElementById('adminPanelView').classList.remove('hidden');
    updateActiveNavLink('adminPanel');
    localStorage.setItem('last_view', 'adminPanel');
}

function showLearn() {
    hideAllViews();
    document.getElementById('learnView').classList.remove('hidden');
    updateActiveNavLink('learn');
    localStorage.setItem('last_view', 'learn');
}

function hideAllViews() {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
}

function updateActiveNavLink(viewName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.view === viewName) {
            link.classList.add('active');
        }
    });
}

// User Menu Functions
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Category Functions
function startCategory(categoryId) {
    // For now, just show a notification
    showNotification(`Starting ${categoryId} category...`, Config.NOTIFICATION.TYPES.INFO);
    
    // TODO: Implement actual category learning functionality
    // This would typically:
    // 1. Load the category content
    // 2. Show the first lesson
    // 3. Track progress
    // 4. Update user statistics
}

// Add a loading flag to prevent multiple simultaneous calls
let categoriesLoading = false;

// Enhanced Categories with Filter Panel and Pagination
let categoriesFilterState = {
    learnedStatus: 'all',
    categoryName: 'all'
};

let allCategoriesData = [];
let currentPage = 1;
const CATEGORIES_PER_PAGE = 9;

async function loadCategories() {
    // Prevent multiple simultaneous calls
    if (categoriesLoading) {
        return;
    }
    
    try {
        categoriesLoading = true;
        
        const token = localStorage.getItem('auth_token');
        if (!token) {
            showNotification('Please log in to view categories', Config.NOTIFICATION.TYPES.ERROR);
            return;
        }

        // Get user's language preference
        const userLanguage = Auth.getCurrentUserLanguage();
        
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) {
            console.error('Categories grid element not found');
            return;
        }

        // Create filter panel if it doesn't exist
        createFilterPanel();

        // Show enhanced loading state
        categoriesGrid.innerHTML = '<div class="categories-loading">Loading your learning categories...</div>';

        // Fetch categories
        const response = await fetch(`${Config.API.BASE_URL}/categories/?language_code=${userLanguage}&active_only=true`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load categories');
        }

        const categories = await response.json();

        // Fetch 'Wants to learn' words ONCE
        let wantsToLearnWords = [];
        try {
            const wantsToLearnResp = await fetch(`${Config.API.BASE_URL}/learning/words/my-list?status=want_to_learn&limit=100&offset=0`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (wantsToLearnResp.ok) {
                wantsToLearnWords = await wantsToLearnResp.json();
            }
        } catch (error) {
            console.warn('Failed to fetch wants to learn words:', error);
        }

        // Process all categories data
        allCategoriesData = [];

        // Add 'Wants to learn' pseudo-category if there are words
        if (wantsToLearnWords.length > 0) {
            allCategoriesData.push({
                id: 'want_to_learn',
                category_name: 'Want to Learn',
                description: 'Words you marked as "want to learn"',
                wordCount: wantsToLearnWords.length,
                learnedCount: 0,
                isSpecial: true,
                icon: 'fa-star',
                learnedStatus: 'not_started'
            });
        }

        // Process regular categories
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            
            // Get the translation for the current language
            const translation = category.translations.find(t => t.language_code === userLanguage) || {
                translated_name: category.category_name,
                translated_description: category.description
            };

            // Fetch word count and progress for this category
            let wordCount = 0;
            let learnedCount = 0;
            
            try {
                const wordsResp = await fetch(`${Config.API.BASE_URL}/categories/${category.id}/words?language_code=${userLanguage}&skip=0&limit=100`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (wordsResp.ok) {
                    const words = await wordsResp.json();
                    wordCount = Array.isArray(words) ? words.length : 0;
                    
                    // Check learned status for words (limit to first 20 for performance)
                    if (words.length > 0) {
                        const wordsToCheck = words.slice(0, 20);
                        for (let j = 0; j < wordsToCheck.length; j++) {
                            try {
                                const statusResp = await fetch(`${Config.API.BASE_URL}/learning/words/${wordsToCheck[j].id}/status`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (statusResp.ok) {
                                    const statusData = await statusResp.json();
                                    if (statusData.status === 'learned') {
                                        learnedCount++;
                                    }
                                }
                            } catch (e) {
                                // Skip status check for this word
                            }
                        }
                        // Estimate total learned count
                        if (words.length > 20) {
                            learnedCount = Math.round((learnedCount / 20) * words.length);
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch data for category ${category.id}:`, error);
            }
            
            // Determine learned status
            let learnedStatus = 'not_started';
            if (wordCount > 0) {
                if (learnedCount === wordCount) {
                    learnedStatus = 'completed';
                } else if (learnedCount > 0) {
                    learnedStatus = 'in_progress';
                }
            }
            
            allCategoriesData.push({
                id: category.id,
                category_name: translation.translated_name,
                originalCategoryName: category.category_name,
                description: translation.translated_description || 'Start learning this category',
                wordCount: wordCount,
                learnedCount: learnedCount,
                isSpecial: false,
                icon: getCategoryIcon(category.category_name),
                learnedStatus: learnedStatus
            });
        }

        // Populate filter options
        populateFilterOptions();
        
        // Reset to first page
        currentPage = 1;
        
        // Render filtered categories with pagination
        renderFilteredCategories();

    } catch (error) {
        console.error('Error loading categories:', error);
        showNotification('Failed to load categories', Config.NOTIFICATION.TYPES.ERROR);
        
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (categoriesGrid) {
            categoriesGrid.innerHTML = '<div class="categories-error">❌ Failed to load categories. Please try refreshing the page.</div>';
        }
    } finally {
        categoriesLoading = false;
    }
}

// Create filter panel
function createFilterPanel() {
    const categoriesView = document.getElementById('categoriesView');
    const existingPanel = document.getElementById('categoriesFilterPanel');
    
    if (existingPanel) {
        return; // Panel already exists
    }
    
    const filterPanel = document.createElement('div');
    filterPanel.id = 'categoriesFilterPanel';
    filterPanel.className = 'categories-filter-panel';
    filterPanel.innerHTML = `
        <div class="filter-panel-header">
            <h3>
                <i class="fas fa-filter"></i>
                Filter Categories
            </h3>
            <div class="filter-active-indicator" id="filterActiveIndicator">
                <i class="fas fa-check-circle"></i>
                Filters Active
            </div>
        </div>
        <div class="filter-controls">
            <div class="filter-group">
                <label class="filter-label" for="learnedStatusFilter">Learning Status</label>
                <select id="learnedStatusFilter" class="filter-select">
                    <option value="all">All Categories</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label" for="categoryNameFilter">Category Name</label>
                <select id="categoryNameFilter" class="filter-select">
                    <option value="all">All Categories</option>
                </select>
            </div>
            <button id="resetFiltersBtn" class="filter-reset-btn">
                <i class="fas fa-undo"></i>
                Reset
            </button>
        </div>
    `;
    
    // Insert after categories header
    const categoriesHeader = categoriesView.querySelector('.categories-header');
    categoriesHeader.insertAdjacentElement('afterend', filterPanel);
    
    // Add event listeners
    setupFilterEventListeners();
}

// Create pagination container
function createPaginationContainer() {
    const categoriesView = document.getElementById('categoriesView');
    let paginationContainer = document.getElementById('categoriesPagination');
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'categoriesPagination';
        paginationContainer.className = 'categories-pagination';
        categoriesView.appendChild(paginationContainer);
    }
    
    return paginationContainer;
}

// Setup filter event listeners
function setupFilterEventListeners() {
    const learnedStatusFilter = document.getElementById('learnedStatusFilter');
    const categoryNameFilter = document.getElementById('categoryNameFilter');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    if (learnedStatusFilter) {
        learnedStatusFilter.addEventListener('change', (e) => {
            categoriesFilterState.learnedStatus = e.target.value;
            currentPage = 1; // Reset to first page when filtering
            renderFilteredCategories();
            updateFilterIndicator();
        });
    }
    
    if (categoryNameFilter) {
        categoryNameFilter.addEventListener('change', (e) => {
            categoriesFilterState.categoryName = e.target.value;
            currentPage = 1; // Reset to first page when filtering
            renderFilteredCategories();
            updateFilterIndicator();
        });
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            resetFilters();
        });
    }
}

// Populate filter options
function populateFilterOptions() {
    const categoryNameFilter = document.getElementById('categoryNameFilter');
    if (!categoryNameFilter) return;
    
    // Clear existing options except "All Categories"
    categoryNameFilter.innerHTML = '<option value="all">All Categories</option>';
    
    // Get unique category names
    const uniqueCategories = [...new Set(allCategoriesData.map(cat => cat.originalCategoryName || cat.category_name))];
    
    uniqueCategories.forEach(categoryName => {
        if (categoryName && categoryName !== 'Want to Learn') {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = allCategoriesData.find(cat => 
                (cat.originalCategoryName || cat.category_name) === categoryName
            )?.category_name || categoryName;
            categoryNameFilter.appendChild(option);
        }
    });
}

// Get filtered categories
function getFilteredCategories() {
    return allCategoriesData.filter(category => {
        // Filter by learned status
        if (categoriesFilterState.learnedStatus !== 'all' && 
            category.learnedStatus !== categoriesFilterState.learnedStatus) {
            return false;
        }
        
        // Filter by category name
        if (categoriesFilterState.categoryName !== 'all' && 
            (category.originalCategoryName || category.category_name) !== categoriesFilterState.categoryName) {
            return false;
        }
        
        return true;
    });
}

// Render filtered categories with pagination
function renderFilteredCategories() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    if (!categoriesGrid) return;
    
    // Get filtered categories
    const filteredCategories = getFilteredCategories();
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE);
    const startIndex = (currentPage - 1) * CATEGORIES_PER_PAGE;
    const endIndex = startIndex + CATEGORIES_PER_PAGE;
    const categoriesForCurrentPage = filteredCategories.slice(startIndex, endIndex);
    
    // Clear grid
    categoriesGrid.innerHTML = '';
    
    if (filteredCategories.length === 0) {
        categoriesGrid.innerHTML = '<div class="categories-error">📝 No categories match your filters. Try adjusting your selection.</div>';
        renderPagination(0, 0);
        return;
    }
    
    // Render categories for current page
    categoriesForCurrentPage.forEach(categoryData => {
        const card = createEnhancedCategoryCard(categoryData);
        categoriesGrid.appendChild(card);
    });
    
    // Render pagination
    renderPagination(filteredCategories.length, totalPages);
}

// Render pagination controls
function renderPagination(totalItems, totalPages) {
    const paginationContainer = createPaginationContainer();
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = `
        <div class="pagination-info">
            Showing ${((currentPage - 1) * CATEGORIES_PER_PAGE) + 1}-${Math.min(currentPage * CATEGORIES_PER_PAGE, totalItems)} of ${totalItems} categories
        </div>
        <div class="pagination-controls">
    `;
    
    // Previous button
    paginationHTML += `
        <button class="pagination-btn${currentPage === 1 ? ' disabled' : ''}" 
                onclick="goToPage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
            Previous
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="pagination-btn${i === currentPage ? ' active' : ''}" 
                    onclick="goToPage(${i})"
                    ${i === currentPage ? 'disabled' : ''}>
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button class="pagination-btn${currentPage === totalPages ? ' disabled' : ''}" 
                onclick="goToPage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            Next
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationHTML += '</div>';
    
    paginationContainer.innerHTML = paginationHTML;
}

// Go to specific page
function goToPage(page) {
    const filteredCategories = getFilteredCategories();
    const totalPages = Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderFilteredCategories();
    
    // Scroll to top of categories
    const categoriesHeader = document.querySelector('.categories-header');
    if (categoriesHeader) {
        categoriesHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Reset filters
function resetFilters() {
    categoriesFilterState = {
        learnedStatus: 'all',
        categoryName: 'all'
    };
    
    currentPage = 1;
    
    // Reset form values
    const learnedStatusFilter = document.getElementById('learnedStatusFilter');
    const categoryNameFilter = document.getElementById('categoryNameFilter');
    
    if (learnedStatusFilter) learnedStatusFilter.value = 'all';
    if (categoryNameFilter) categoryNameFilter.value = 'all';
    
    // Re-render categories
    renderFilteredCategories();
    updateFilterIndicator();
    
    showNotification('Filters reset', Config.NOTIFICATION.TYPES.INFO);
}

// Update filter indicator
function updateFilterIndicator() {
    const indicator = document.getElementById('filterActiveIndicator');
    if (!indicator) return;
    
    const hasActiveFilters = categoriesFilterState.learnedStatus !== 'all' || 
                            categoriesFilterState.categoryName !== 'all';
    
    if (hasActiveFilters) {
        indicator.classList.add('show');
    } else {
        indicator.classList.remove('show');
    }
}

// Add to global scope
window.goToPage = goToPage;

// Create enhanced category card function
function createEnhancedCategoryCard({ id, category_name, description, wordCount, learnedCount, isSpecial, icon }) {
    const card = document.createElement('div');
    card.className = `category-card ${isSpecial ? 'want-to-learn' : ''}`;
    const allLearned = wordCount > 0 && learnedCount === wordCount;
    const hasProgress = wordCount > 0 && learnedCount > 0;
    card.innerHTML = `
        <div class="category-icon ${isSpecial ? 'special' : ''}">
            <i class="fas ${icon}"></i>
        </div>
        <div class="category-info">
            <h3>
                ${category_name}
                <span class="word-count-badge">${wordCount} word${wordCount !== 1 ? 's' : ''}</span>
            </h3>
            <p>${description}</p>
        </div>
        ${createProgressSection(wordCount, learnedCount, allLearned, hasProgress)}
        <button class="btn btn-success" onclick="startLearning('${id}')">
            <i class="fas fa-play"></i>
            ${allLearned ? 'Review' : 'Start Learning'}
        </button>
        <button class="btn btn-primary" style="margin-left: 0.5rem;" onclick="window.location.href='repeat.html?category_id=${id}'">
            Repeat
        </button>
        <button class="btn btn-info" style="margin-left: 0.5rem;" onclick="window.location.href='repeat-audio.html?category_id=${id}'">
            Repeat (Audio)
        </button>
        <button class="btn btn-warning" style="margin-left: 0.5rem;" onclick="window.location.href='write.html?category_id=${id}'">
            Write
        </button>
        <button class="btn btn-outline-dark" style="margin-left: 0.5rem;" onclick="startCustomLearningProcess('${id}')">
            <i class="fas fa-layer-group"></i>
            Custom Learn
        </button>
    `;
    return card;
}

// Create learning progress text
function createLearningProgress(wordCount, learnedCount, allLearned) {
    if (wordCount === 0) {
        return '<div class="learning-progress">No words available</div>';
    }
    
    if (allLearned) {
        return '<div class="learning-progress completed">🎉 All words learned!</div>';
    } else if (learnedCount > 0) {
        return `<div class="learning-progress">${learnedCount} of ${wordCount} words learned</div>`;
    } else {
        return `<div class="learning-progress">0 of ${wordCount} words learned</div>`;
    }
}

// Create progress section
function createProgressSection(wordCount, learnedCount, allLearned, hasProgress) {
    if (wordCount === 0) return '';
    if (allLearned) {
        return `
            <div class="progress-section">
                <span class="progress-badge learned">
                    <i class="fas fa-check-circle"></i>
                    Completed
                </span>
            </div>
        `;
    } else if (hasProgress) {
        const percentage = Math.round((learnedCount / wordCount) * 100);
        return `
            <div class="progress-section">
                <span class="progress-badge">
                    <i class="fas fa-chart-line"></i>
                    ${learnedCount}/${wordCount} learned (${percentage}%)
                </span>
            </div>
        `;
    }
    return '';
}

// Get appropriate icon for category
function getCategoryIcon(categoryName) {
    const iconMap = {
        'Basic': 'fa-seedling',
        'Family': 'fa-users',
        'Food': 'fa-utensils',
        'Animals': 'fa-paw',
        'Colors': 'fa-palette',
        'Numbers': 'fa-calculator',
        'Time': 'fa-clock',
        'Weather': 'fa-cloud-sun',
        'Travel': 'fa-plane',
        'Body': 'fa-user',
        'Emotions': 'fa-heart',
        'Business': 'fa-briefcase',
        'Technology': 'fa-laptop',
        'Sports': 'fa-running',
        'Music': 'fa-music',
        'Education': 'fa-graduation-cap',
        'Home': 'fa-home',
        'Clothing': 'fa-tshirt',
        'Transportation': 'fa-car',
        'Nature': 'fa-leaf',
        'Health': 'fa-heartbeat',
        'Shopping': 'fa-shopping-cart'
    };
    
    return iconMap[categoryName] || 'fa-book';
}

// Enhanced start learning function
function startLearning(categoryId) {
    const button = event.target;
    
    // Add click animation
    button.style.transform = 'scale(0.95)';
    button.style.transition = 'transform 0.1s ease';
    
    // Show loading state
    const originalContent = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    button.disabled = true;
    
    setTimeout(() => {
        button.style.transform = '';
        window.location.href = `learn.html?category_id=${categoryId}`;
    }, 300);
}

// Add to global scope for onclick handlers
window.startLearning = startLearning;

function startCustomLearningProcess(categoryId) {
    // Store the selected category in localStorage or sessionStorage
    localStorage.setItem('custom_learning_category_id', categoryId);
    // Redirect to the custom learning process view
    window.location.href = 'custom-learning.html?category_id=' + categoryId;
}
window.startCustomLearningProcess = startCustomLearningProcess;

// Close dropdowns when clicking outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('userDropdown');
    const userAvatar = document.getElementById('userAvatar');
    
    if (dropdown && userAvatar) {
        if (!userAvatar.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    }
});

let allWordsData = [];
let allWordsCategories = [];
let selectedCategory = null;
let allWordsSearchQuery = '';
let userWantToLearnWordIds = new Set();
let allWordsTypes = [];
let selectedType = null;
let allWordsCurrentPage = 1;
const ALL_WORDS_PAGE_SIZE = "15";
let allWordsDifficultyLevels = [];
let selectedDifficulty = null;

async function loadAllWordsCategories() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const userLanguage = Auth.getCurrentUserLanguage();
        const response = await fetch(`${Config.API.BASE_URL}/categories/?language_code=${userLanguage}&active_only=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load categories');
        allWordsCategories = await response.json();
        // Set default category to id=2 if not already set
        if (selectedCategory === null) {
            const defaultCat = allWordsCategories.find(c => c.id === 2);
            if (defaultCat) selectedCategory = defaultCat.category_name;
        }
        renderAllWordsCategories(userLanguage);
        renderAllWordsTable();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderAllWordsCategories(userLanguage) {
    const list = document.getElementById('allWordsCategoryList');
    if (!list) return;
    list.innerHTML = '';
    // Add 'All' option
    const allLi = document.createElement('li');
    allLi.className = 'category-filter' + (selectedCategory === null ? ' active' : '');
    allLi.textContent = 'All';
    allLi.onclick = () => { selectedCategory = null; resetAllWordsPage(); renderAllWordsTable(); setActiveCategoryFilter(null); };
    list.appendChild(allLi);
    // Add categories
    allWordsCategories.forEach(cat => {
        const translation = cat.translations.find(t => t.language_code === userLanguage) || { translated_name: cat.category_name };
        const li = document.createElement('li');
        li.className = 'category-filter' + (selectedCategory === cat.category_name ? ' active' : '');
        li.textContent = translation.translated_name;
        li.onclick = () => { selectedCategory = cat.category_name; resetAllWordsPage(); renderAllWordsTable(); setActiveCategoryFilter(cat.category_name); };
        list.appendChild(li);
    });
}

function setActiveCategoryFilter(categoryName) {
    document.querySelectorAll('#allWordsCategoryList .category-filter').forEach(li => {
        if ((categoryName === null && li.textContent === 'All') || (li.textContent === getCategoryTranslatedName(categoryName))) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

function getCategoryTranslatedName(categoryName) {
    if (!categoryName) return 'All';
    const userLanguage = Auth.getCurrentUserLanguage();
    const cat = allWordsCategories.find(c => c.category_name === categoryName);
    if (!cat) return categoryName;
    const translation = cat.translations.find(t => t.language_code === userLanguage);
    return translation ? translation.translated_name : cat.category_name;
}

async function loadAllWordsTypes() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const userLanguage = Auth.getCurrentUserLanguage();
        const response = await fetch(`${Config.API.BASE_URL}/word-types/?language_code=${userLanguage}&active_only=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load word types');
        allWordsTypes = await response.json();
        // Set default type to id=1 if not already set
        if (selectedType === null) {
            const defaultType = allWordsTypes.find(t => t.id === 1);
            if (defaultType) selectedType = defaultType.type_name;
        }
        renderAllWordsTypes(userLanguage);
        renderAllWordsTable();
    } catch (error) {
        console.error('Error loading word types:', error);
    }
}

function renderAllWordsTypes(userLanguage) {
    const list = document.getElementById('allWordsTypeList');
    if (!list) return;
    list.innerHTML = '';
    // Add 'All' option
    const allLi = document.createElement('li');
    allLi.className = 'type-filter' + (selectedType === null ? ' active' : '');
    allLi.textContent = 'All';
    allLi.onclick = () => { selectedType = null; resetAllWordsPage(); renderAllWordsTable(); setActiveTypeFilter(null); };
    list.appendChild(allLi);
    // Add types
    allWordsTypes.forEach(type => {
        const translation = type.translations.find(t => t.language_code === userLanguage) || { translated_name: type.type_name };
        const li = document.createElement('li');
        li.className = 'type-filter' + (selectedType === type.type_name ? ' active' : '');
        li.textContent = translation.translated_name;
        li.onclick = () => { selectedType = type.type_name; resetAllWordsPage(); renderAllWordsTable(); setActiveTypeFilter(type.type_name); };
        list.appendChild(li);
    });
}

function setActiveTypeFilter(typeName) {
    document.querySelectorAll('#allWordsTypeList .type-filter').forEach(li => {
        if ((typeName === null && li.textContent === 'All') || (li.textContent === getTypeTranslatedName(typeName))) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

function getTypeTranslatedName(typeName) {
    if (!typeName) return 'All';
    const userLanguage = Auth.getCurrentUserLanguage();
    const type = allWordsTypes.find(t => t.type_name === typeName);
    if (!type) return typeName;
    const translation = type.translations.find(t => t.language_code === userLanguage);
    return translation ? translation.translated_name : type.type_name;
}

async function loadAllWords() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const userLanguage = Auth.getCurrentUserLanguage();
        // Fetch all words
        const response = await fetch(`${Config.API.BASE_URL}/words/?language_code=${userLanguage}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load words');
        allWordsData = await response.json();
        // Fetch user's want_to_learn words from /learning/words/my-list
        const favResp = await fetch(`${Config.API.BASE_URL}/learning/words/my-list?limit=100&offset=0`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (favResp.ok) {
            const favWords = await favResp.json();
            userWantToLearnWordIds = new Set(
                favWords.filter(w => w.status === 'want_to_learn').map(w => w.kazakh_word_id)
            );
        } else {
            userWantToLearnWordIds = new Set();
        }
        renderAllWordsTable();
    } catch (error) {
        console.error('Error loading words:', error);
    }
}

// Add event listeners for search
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('allWordsSearchInput');
        const searchBtn = document.getElementById('allWordsSearchBtn');
        if (searchInput && searchBtn) {
            searchInput.addEventListener('input', (e) => {
                allWordsSearchQuery = e.target.value.trim();
                resetAllWordsPage();
                renderAllWordsTable();
            });
            searchBtn.addEventListener('click', () => {
                allWordsSearchQuery = searchInput.value.trim();
                resetAllWordsPage();
                renderAllWordsTable();
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    allWordsSearchQuery = searchInput.value.trim();
                    resetAllWordsPage();
                    renderAllWordsTable();
                }
            });
        }
        const resetBtn = document.getElementById('resetAllWordsFilterBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                selectedType = null;
                selectedCategory = null;
                selectedDifficulty = null;
                setActiveTypeFilter(null);
                setActiveCategoryFilter(null);
                setActiveDifficultyFilter(null);
                if (searchInput) {
                    searchInput.value = '';
                }
                allWordsSearchQuery = '';
                resetAllWordsPage();
                renderAllWordsTable();
            });
        }
    });
}

function renderDifficultyBadge(difficulty) {
    let colorClass = 'difficulty-badge-easy';
    let text = '';
    // Accepts either string ("easy", "medium", "hard") or number (1,2,3)
    if (typeof difficulty === 'string') {
        text = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        if (difficulty === 'easy') colorClass = 'difficulty-badge-easy';
        else if (difficulty === 'medium') colorClass = 'difficulty-badge-medium';
        else if (difficulty === 'hard') colorClass = 'difficulty-badge-hard';
        else colorClass = 'difficulty-badge-easy';
    } else if (typeof difficulty === 'number') {
        text = getDifficultyTranslatedName(difficulty);
        if (difficulty === 1) colorClass = 'difficulty-badge-easy';
        else if (difficulty === 2) colorClass = 'difficulty-badge-medium';
        else if (difficulty >= 3) colorClass = 'difficulty-badge-hard';
    } else {
        text = '-';
    }
    return `<span class="difficulty-badge ${colorClass}">${text}</span>`;
}

async function loadAllWordsDifficultyLevels() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const userLanguage = Auth.getCurrentUserLanguage();
        const response = await fetch(`${Config.API.BASE_URL}/difficulty-levels/?language_code=${userLanguage}&active_only=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to load difficulty levels');
        allWordsDifficultyLevels = await response.json();
        renderAllWordsDifficulty(userLanguage);
    } catch (error) {
        console.error('Error loading difficulty levels:', error);
    }
}

function renderAllWordsDifficulty(userLanguage) {
    const list = document.getElementById('allWordsDifficultyList');
    if (!list) return;
    list.innerHTML = '';
    // Add 'All' option
    const allLi = document.createElement('li');
    allLi.className = 'difficulty-filter' + (selectedDifficulty === null ? ' active' : '');
    allLi.textContent = 'All';
    allLi.onclick = () => {
        selectedDifficulty = null;
        resetAllWordsPage();
        renderAllWordsTable();
        setActiveDifficultyFilter(null);
    };
    list.appendChild(allLi);
    // Add levels
    allWordsDifficultyLevels.forEach(level => {
        const translation = level.translations.find(t => t.language_code === userLanguage) || { translated_name: level.level_name };
        const li = document.createElement('li');
        li.className = 'difficulty-filter' + (selectedDifficulty === level.level_number ? ' active' : '');
        li.textContent = translation.translated_name;
        li.onclick = () => {
            selectedDifficulty = level.level_number;
            resetAllWordsPage();
            renderAllWordsTable();
            setActiveDifficultyFilter(level.level_number);
        };
        list.appendChild(li);
    });
}

function setActiveDifficultyFilter(value) {
    document.querySelectorAll('#allWordsDifficultyList .difficulty-filter').forEach(li => {
        if ((value === null && li.textContent === 'All') ||
            (allWordsDifficultyLevels.some(l => l.level_number === value && li.textContent === getDifficultyTranslatedName(l.level_number)))) {
            li.classList.add('active');
        } else {
            li.classList.remove('active');
        }
    });
}

function getDifficultyTranslatedName(levelNumber) {
    const userLanguage = Auth.getCurrentUserLanguage();
    const level = allWordsDifficultyLevels.find(l => l.level_number === levelNumber);
    if (!level) return levelNumber;
    const translation = level.translations.find(t => t.language_code === userLanguage);
    return translation ? translation.translated_name : level.level_name;
}

function renderAllWordsTable() {
    const tbody = document.querySelector('#allWordsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let filtered = allWordsData;
    if (selectedCategory) {
        filtered = filtered.filter(w => w.category_name === selectedCategory);
    }
    if (selectedType) {
        filtered = filtered.filter(w => w.word_type_name === selectedType);
    }
    if (selectedDifficulty) {
        filtered = filtered.filter(w => w.difficulty_level === selectedDifficulty);
    }
    if (allWordsSearchQuery) {
        const q = allWordsSearchQuery.toLowerCase();
        filtered = filtered.filter(word =>
            (word.kazakh_word && word.kazakh_word.toLowerCase().includes(q)) ||
            (word.kazakh_cyrillic && word.kazakh_cyrillic.toLowerCase().includes(q)) ||
            (word.primary_translation && word.primary_translation.toLowerCase().includes(q)) ||
            (word.word_type_name && getTypeTranslatedName(word.word_type_name).toLowerCase().includes(q)) ||
            (getCategoryTranslatedName(word.category_name).toLowerCase().includes(q)) ||
            (getDifficultyTranslatedName(word.difficulty_level).toLowerCase().includes(q))
        );
    }
    // Pagination logic
    const totalPages = Math.max(1, Math.ceil(filtered.length / ALL_WORDS_PAGE_SIZE));
    if (allWordsCurrentPage > totalPages) allWordsCurrentPage = totalPages;
    const startIdx = (allWordsCurrentPage - 1) * ALL_WORDS_PAGE_SIZE;
    const endIdx = startIdx + ALL_WORDS_PAGE_SIZE;
    const pageWords = filtered.slice(startIdx, endIdx);
    // --- Add cache for statuses ---
    if (!window.wordLearningStatusCache) window.wordLearningStatusCache = {};
    const statusCache = window.wordLearningStatusCache;
    // ---
    if (pageWords.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9; // updated for new column
        td.textContent = 'No words found.';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        pageWords.forEach(word => {
            const isAdded = userWantToLearnWordIds.has(word.id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center;">
                    <button class="btn btn-icon btn-add-favorite${isAdded ? ' added' : ''}" title="Add to My Words" onclick="addWordToFavorites(${word.id}, this)" ${isAdded ? 'disabled' : ''}>
                        <i class="fas ${isAdded ? 'fa-check' : 'fa-plus'}"></i>
                    </button>
                </td>
                <td>${word.kazakh_word}</td>
                <td>${word.kazakh_cyrillic}</td>
                <td>${getTypeTranslatedName(word.word_type_name)}</td>
                <td>${getCategoryTranslatedName(word.category_name)}</td>
                <td>${renderDifficultyBadge(word.difficulty_level)}</td>
                <td>${word.primary_translation}</td>
                <td>${word.primary_image ? `<img src=\"${word.primary_image}\" alt=\"Image\" style=\"max-width:40px;max-height:40px;\">` : ''}</td>
                <td><button class="btn btn-icon" title="Play Sound" onclick="playWordSound(${word.id}, this)"><i class="fas fa-volume-up"></i></button></td>
                <td id="learning-status-${word.id}">Loading...</td>
            `;
            tbody.appendChild(tr);
            // Fetch and display learning status
            const statusCell = tr.querySelector(`#learning-status-${word.id}`);
            if (statusCache[word.id]) {
                statusCell.textContent = statusCache[word.id];
            } else {
                statusCell.textContent = 'Loading...';
                fetchLearningStatus(word.id, statusCell, statusCache);
            }
        });
    }
    renderAllWordsPagination(totalPages);
}

async function fetchLearningStatus(wordId, cell, cache) {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            cell.textContent = '-';
            return;
        }
        const response = await fetch(`${Config.API.BASE_SIZE}/learning/words/${wordId}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            cell.textContent = '-';
            return;
        }
        const data = await response.json();
        const status = data.status || '-';
        cache[wordId] = status;
        cell.textContent = status;
    } catch (e) {
        cell.textContent = '-';
    }
}

function renderAllWordsPagination(totalPages) {
    const container = document.getElementById('allWordsPagination');
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-pagination';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = allWordsCurrentPage === 1;
    prevBtn.onclick = () => { allWordsCurrentPage--; renderAllWordsTable(); };
    container.appendChild(prevBtn);
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'btn btn-pagination' + (i === allWordsCurrentPage ? ' active' : '');
        pageBtn.textContent = i;
        pageBtn.disabled = i === allWordsCurrentPage;
        pageBtn.onclick = () => { allWordsCurrentPage = i; renderAllWordsTable(); };
        container.appendChild(pageBtn);
    }
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-pagination';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = allWordsCurrentPage === totalPages;
    nextBtn.onclick = () => { allWordsCurrentPage++; renderAllWordsTable(); };
    container.appendChild(nextBtn);
}

// Reset page to 1 when filters/search change
function resetAllWordsPage() {
    allWordsCurrentPage = 1;
}

window.addWordToFavorites = async function(wordId, btn) {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            showNotification('Please log in to add words', Config.NOTIFICATION.TYPES.ERROR);
            return;
        }
        btn.disabled = true;
        btn.querySelector('i').classList.remove('fa-plus');
        btn.querySelector('i').classList.add('fa-spinner', 'fa-spin');
        const response = await fetch(`${Config.API.BASE_URL}/learning/words/${wordId}/add?status=want_to_learn`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        btn.querySelector('i').classList.remove('fa-spinner', 'fa-spin');
        if (response.ok) {
            btn.querySelector('i').classList.add('fa-check');
            btn.querySelector('i').classList.remove('fa-plus');
            btn.classList.add('added');
            userWantToLearnWordIds.add(wordId);
            showNotification('Word added to your list!', Config.NOTIFICATION.TYPES.SUCCESS);
        } else {
            btn.disabled = false;
            btn.querySelector('i').classList.add('fa-plus');
            showNotification('Failed to add word', Config.NOTIFICATION.TYPES.ERROR);
        }
    } catch (error) {
        btn.disabled = false;
        btn.querySelector('i').classList.add('fa-plus');
        showNotification('Error adding word', Config.NOTIFICATION.TYPES.ERROR);
    }
}

window.playWordSound = async function(wordId, btn) {
    try {
        btn.disabled = true;
        const token = localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${Config.API.BASE_URL}/word-sounds/${wordId}`, { headers });
        if (!response.ok) throw new Error('No sound available');
        const data = await response.json();
        let soundUrl = null;
        if (Array.isArray(data) && data.length > 0) {
            const sound = data[0];
            if (sound.sound_url && sound.sound_url !== 'string') {
                soundUrl = sound.sound_url;
            } else if (sound.sound_path && sound.sound_path !== 'string') {
                soundUrl = sound.sound_path;
            }
        }
        if (!soundUrl) throw new Error('No valid sound found');
        window.open(soundUrl, '_blank');
    } catch (error) {
        showNotification('Sound not available or not supported', Config.NOTIFICATION.TYPES.ERROR);
    } finally {
        btn.disabled = false;
    }
}

let myWordsRawData = [];
let myWordsFilteredData = [];
let myWordsDifficulties = [];
let myWordsCategories = [];

async function loadMyWords() {
    const tbody = document.querySelector('#myWordsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            tbody.innerHTML = '<tr><td colspan="6">Please log in to see your words.</td></tr>';
            return;
        }
        const userLang = Auth.getCurrentUserLanguage();
        // Fetch and cache categories for translation
        if (!window.myWordsCategoriesCache || window.myWordsCategoriesCacheLang !== userLang) {
            const catResp = await fetch(`${Config.API.BASE_URL}/categories/?language_code=${userLang}&active_only=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (catResp.ok) {
                window.myWordsCategoriesCache = await catResp.json();
                window.myWordsCategoriesCacheLang = userLang;
            } else {
                window.myWordsCategoriesCache = [];
            }
        }
        const categories = window.myWordsCategoriesCache || [];
        // Fetch difficulties (from user's words only)
        let difficultiesSet = new Set();
        // Fetch user words
        const response = await fetch(`${Config.API.BASE_URL}/learning/words/my-list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            tbody.innerHTML = '<tr><td colspan="6">Failed to load your words.</td></tr>';
            return;
        }
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No words found in your list.</td></tr>';
            return;
        }
        myWordsRawData = data;
        // Populate difficulties and categories for filters
        myWordsDifficulties = Array.from(new Set(data.map(item => item.kazakh_word?.difficulty_level).filter(Boolean)));
        myWordsCategories = Array.from(new Set(data.map(item => item.kazakh_word?.category_name).filter(Boolean)));
        populateMyWordsFilters(categories, myWordsDifficulties, userLang);
        // Initial render
        filterAndRenderMyWords();
        // Attach filter/search listeners (only once)
        if (!window.myWordsFiltersInitialized) {
            document.getElementById('myWordsStatusFilter').addEventListener('change', filterAndRenderMyWords);
            document.getElementById('myWordsDifficultyFilter').addEventListener('change', filterAndRenderMyWords);
            document.getElementById('myWordsCategoryFilter').addEventListener('change', filterAndRenderMyWords);
            document.getElementById('myWordsSearchBtn').addEventListener('click', filterAndRenderMyWords);
            document.getElementById('myWordsSearchInput').addEventListener('keydown', function(e) {
                if (e.key === 'Enter') filterAndRenderMyWords();
            });
            document.getElementById('resetMyWordsFilterBtn').addEventListener('click', () => {
                document.getElementById('myWordsStatusFilter').value = '';
                document.getElementById('myWordsDifficultyFilter').value = '';
                document.getElementById('myWordsCategoryFilter').value = '';
                document.getElementById('myWordsSearchInput').value = '';
                filterAndRenderMyWords();
            });
            // Toggle Translations column
            let translationsVisible = true;
            document.getElementById('toggleMyWordsTranslationsBtn').addEventListener('click', function() {
                translationsVisible = !translationsVisible;
                const btn = this;
                const table = document.getElementById('myWordsTable');
                // Toggle header
                const ths = table.querySelectorAll('thead th');
                if (ths[4]) ths[4].style.display = translationsVisible ? '' : 'none';
                // Toggle all rows
                table.querySelectorAll('tbody tr').forEach(tr => {
                    const tds = tr.querySelectorAll('td');
                    if (tds[4]) tds[4].style.display = translationsVisible ? '' : 'none';
                });
                btn.innerHTML = translationsVisible
                    ? '<i class="fas fa-language"></i> Hide Translations'
                    : '<i class="fas fa-language"></i> Show Translations';
            });
            window.myWordsFiltersInitialized = true;
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6">Error loading your words.</td></tr>';
    }
}

function populateMyWordsFilters(categories, difficulties, userLang) {
    // Difficulty
    const diffSel = document.getElementById('myWordsDifficultyFilter');
    diffSel.innerHTML = '<option value="">All Difficulties</option>';
    difficulties.forEach(level => {
        diffSel.innerHTML += `<option value="${level}">${getDifficultyTranslatedName(level)}</option>`;
    });
    // Category
    const catSel = document.getElementById('myWordsCategoryFilter');
    catSel.innerHTML = '<option value="">All Categories</option>';
    myWordsCategories.forEach(catName => {
        let label = catName;
        const cat = categories.find(c => c.category_name === catName);
        if (cat) {
            const t = (cat.translations || []).find(tr => tr.language_code === userLang);
            if (t && t.translated_name) label = t.translated_name;
        }
        catSel.innerHTML += `<option value="${catName}">${label}</option>`;
    });
}

function filterAndRenderMyWords() {
    const status = document.getElementById('myWordsStatusFilter').value;
    const difficulty = document.getElementById('myWordsDifficultyFilter').value;
    const category = document.getElementById('myWordsCategoryFilter').value;
    const search = document.getElementById('myWordsSearchInput').value.trim().toLowerCase();
    const tbody = document.querySelector('#myWordsTable tbody');
    const userLang = Auth.getCurrentUserLanguage();
    const categories = window.myWordsCategoriesCache || [];
    let filtered = myWordsRawData;
    if (status) filtered = filtered.filter(item => item.status === status);
    if (difficulty) filtered = filtered.filter(item => String(item.kazakh_word?.difficulty_level) === difficulty);
    if (category) filtered = filtered.filter(item => item.kazakh_word?.category_name === category);
    if (search) {
        filtered = filtered.filter(item => {
            const word = item.kazakh_word || {};
            return (
                (word.kazakh_word && word.kazakh_word.toLowerCase().includes(search)) ||
                (word.kazakh_cyrillic && word.kazakh_cyrillic.toLowerCase().includes(search)) ||
                (word.translations && word.translations.some(tr => tr.translation && tr.translation.toLowerCase().includes(search)))
            );
        });
    }
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No words found.</td></tr>';
        return;
    }
    filtered.forEach(item => {
        const word = item.kazakh_word || {};
        let translation = '';
        if (Array.isArray(word.translations)) {
            const t = word.translations.find(tr => tr.language_code === userLang);
            if (t) translation = t.translation;
        }
        // Find category translation
        let categoryTranslated = word.category_name || '';
        if (word.category_name && categories.length > 0) {
            const cat = categories.find(c => c.category_name === word.category_name);
            if (cat) {
                const t = (cat.translations || []).find(tr => tr.language_code === userLang);
                if (t && t.translated_name) categoryTranslated = t.translated_name;
                else if (cat.category_name) categoryTranslated = cat.category_name;
            }
        }
        // Render difficulty badge (prefer user-specific, fallback to word default)
        let difficultyValue = item.difficulty_rating || word.difficulty_level;
        let difficultyHtml = renderDifficultyBadge(difficultyValue);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${word.kazakh_word || ''}</td>
            <td>${word.kazakh_cyrillic || ''}</td>
            <td>${categoryTranslated}</td>
            <td>${difficultyHtml}</td>
            <td>${translation}</td>
            <td>${item.status || ''}</td>
        `;
        tbody.appendChild(tr);
    });
    // Hide translations column if needed
    const translationsVisible = document.getElementById('toggleMyWordsTranslationsBtn') &&
        document.getElementById('toggleMyWordsTranslationsBtn').innerText.includes('Hide');
    const table = document.getElementById('myWordsTable');
    const ths = table.querySelectorAll('thead th');
    if (ths[4]) ths[4].style.display = translationsVisible ? '' : 'none';
    table.querySelectorAll('tbody tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds[4]) tds[4].style.display = translationsVisible ? '' : 'none';
    });
}

// Handle Trip click in Learn view
function setupLearnView() {
    const tripItem = document.querySelector('.learn-menu-item i.fas.fa-route')?.parentElement;
    if (tripItem) {
        tripItem.addEventListener('click', async () => {
            await loadTripCategories();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    Navigation.init();
    setupLearnView();
    // Restore last view
    const lastView = localStorage.getItem('last_view') || 'dashboard';
    switch (lastView) {
        case 'myWords': showMyWords(); break;
        case 'allWords': showAllWords(); break;
        case 'categories': showCategories(); break;
        case 'practice': showPractice(); break;
        case 'adminPanel': showAdminPanel(); break;
        default: showDashboard(); break;
    }
});

// Admin Panel show/hide categories panel logic
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('toggleAdminCategoriesPanelBtn');
        const panel = document.getElementById('adminCategoriesPanel');
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', function() {
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : '';
                toggleBtn.innerHTML = isVisible
                    ? '<i class="fas fa-list"></i> Show Categories Panel'
                    : '<i class="fas fa-list"></i> Hide Categories Panel';
            });
        }
    });
}

async function loadTripCategories() {
    const mainArea = document.querySelector('.learn-main');
    if (mainArea) {
        mainArea.innerHTML = '<h2>Categories</h2><p>Loading...</p>';
    }
    let language = 'ru';
    if (Auth && Auth.getCurrentUserLanguage) {
        language = Auth.getCurrentUserLanguage() || 'ru';
    }
    try {
        const token = localStorage.getItem('auth_token');
        const resp = await fetch(`${Config.API.BASE_URL}/categories/?language_code=${language}&active_only=true`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!resp.ok) throw new Error('Failed to fetch categories');
        const categories = await resp.json();
        if (!categories.length) {
            if (mainArea) mainArea.innerHTML = '<p>No categories found.</p>';
            return;
        }
        // Fetch word counts for each category in parallel
        const wordCountPromises = categories.map(async cat => {
            const wordsResp = await fetch(`${Config.API.BASE_URL}/categories/${cat.id}/words?language_code=${language}&skip=0&limit=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!wordsResp.ok) return 0;
            const words = await wordsResp.json();
            return Array.isArray(words) ? words.length : 0;
        });
        const wordCounts = await Promise.all(wordCountPromises);
        if (mainArea) {
            mainArea.innerHTML = '<h2>Categories</h2>' +
                categories.map((cat, idx) => {
                    const t = cat.translations.find(tr => tr.language_code === language) || {};
                    const count = wordCounts[idx];
                    return `<div style="margin-bottom:1.5rem; padding:1rem; border:1px solid #eee; border-radius:8px; background:#fff;">
                        <h3>${t.translated_name || cat.category_name} <span style='color:#888; font-size:1rem;'>(${count} words)</span></h3>
                        <p>${t.translated_description || cat.description || ''}</p>
                    </div>`;
                }).join('');
        }
    } catch (e) {
        if (mainArea) mainArea.innerHTML = `<p style='color:red;'>Error: ${e.message}</p>`;
    }
} 