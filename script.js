document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const tabLinks = document.querySelectorAll('.profile-nav-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const mobileMenuButton = document.querySelector('.mobile-menu-button');
    const nav = document.querySelector('.nav');
    
    // Default user to fetch
    let currentUser = 'prk-adi';
    let contributionsChart = null;
    
    // Initialize the page
    fetchUserData(currentUser);
    setupEventListeners();
    
    function setupEventListeners() {
        // Mobile menu toggle
        mobileMenuButton.addEventListener('click', function() {
            nav.classList.toggle('active');
        });
        
        // Tab switching
        tabLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Remove active class from all tabs
                tabLinks.forEach(tab => tab.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked tab
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).classList.add('active');
                
                // Load data for the tab if needed
                if (tabId === 'repos-tab') {
                    fetchRepos(currentUser);
                }
            });
        });
        
        // Search functionality
        searchButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });
        
        // Repo search and filter
        const repoSearch = document.getElementById('repo-search');
        const repoType = document.getElementById('repo-type');
        const repoSort = document.getElementById('repo-sort');
        
        if (repoSearch && repoType && repoSort) {
            repoSearch.addEventListener('input', debounce(() => {
                if (document.getElementById('repos-tab').classList.contains('active')) {
                    fetchRepos(currentUser);
                }
            }, 300));
            
            repoType.addEventListener('change', () => fetchRepos(currentUser));
            repoSort.addEventListener('change', () => fetchRepos(currentUser));
        }
    }
    
    function handleSearch() {
        const username = searchInput.value.trim();
        if (username && username !== currentUser) {
            currentUser = username;
            fetchUserData(username);
            // Reset scroll position
            window.scrollTo(0, 0);
        }
    }
    
    async function fetchUserData(username) {
        try {
            // Show loading state
            showLoading(true);
            
            // Clear any existing errors
            clearErrors();
            
            // Fetch user data
            const userResponse = await fetch(`https://api.github.com/users/${username}`);
            
            if (!userResponse.ok) {
                const errorData = await userResponse.json();
                throw new Error(errorData.message || 'User not found');
            }
            
            const userData = await userResponse.json();
            
            // Update profile section
            updateProfile(userData);
            
            // Fetch pinned repos (GitHub doesn't have a direct API for this, so we'll use regular repos)
            fetchPinnedRepos(username);
            
            // Initialize contributions chart
            initContributionsChart();
            
        } catch (error) {
            showError(error.message);
        } finally {
            showLoading(false);
        }
    }
    
    function updateProfile(userData) {
        document.getElementById('avatar').src = userData.avatar_url;
        document.getElementById('name').textContent = userData.name || userData.login;
        document.getElementById('login').textContent = `@${userData.login}`;
        document.getElementById('bio').textContent = userData.bio || 'No bio available.';
        document.getElementById('followers').textContent = userData.followers.toLocaleString();
        document.getElementById('following').textContent = userData.following.toLocaleString();
        document.getElementById('repo-count').textContent = userData.public_repos.toLocaleString();
        
        // Update location if available
        const locationContainer = document.getElementById('location-container');
        const location = document.getElementById('location');
        if (userData.location) {
            location.textContent = userData.location;
            locationContainer.style.display = 'flex';
        } else {
            locationContainer.style.display = 'none';
        }
        
        // Update website/blog if available
        const blogContainer = document.getElementById('blog-container');
        const blog = document.getElementById('blog');
        if (userData.blog) {
            let blogUrl = userData.blog;
            if (!blogUrl.startsWith('http')) {
                blogUrl = 'https://' + blogUrl;
            }
            blog.href = blogUrl;
            blog.textContent = blogUrl.replace(/^https?:\/\//, '');
            blogContainer.style.display = 'flex';
        } else {
            blogContainer.style.display = 'none';
        }
        
        // Update Twitter if available
        const twitterContainer = document.getElementById('twitter-container');
        const twitter = document.getElementById('twitter');
        if (userData.twitter_username) {
            twitter.href = `https://twitter.com/${userData.twitter_username}`;
            twitter.textContent = `@${userData.twitter_username}`;
            twitterContainer.style.display = 'flex';
        } else {
            twitterContainer.style.display = 'none';
        }
    }
    
    async function fetchPinnedRepos(username) {
        try {
            // In a real app, we would fetch actual pinned repos
            // Since GitHub doesn't provide this via API, we'll fetch the first few repos
            const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=6`);
            
            if (!reposResponse.ok) {
                throw new Error('Failed to fetch repositories');
            }
            
            const reposData = await reposResponse.json();
            updatePinnedRepos(reposData);
            
        } catch (error) {
            console.error('Error fetching pinned repos:', error);
            document.getElementById('pinned-repos').innerHTML = '<p>Unable to load pinned repositories.</p>';
        }
    }
    
    async function fetchRepos(username) {
        try {
            showLoading(true, 'repos');
            
            // Get search and filter values
            const searchQuery = document.getElementById('repo-search')?.value || '';
            const type = document.getElementById('repo-type')?.value || 'all';
            const sort = document.getElementById('repo-sort')?.value || 'updated';
            
            // Fetch repos
            const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=${sort}&type=${type}`);
            
            if (!reposResponse.ok) {
                throw new Error('Failed to fetch repositories');
            }
            
            const reposData = await reposResponse.json();
            
            // Filter by search query
            let filteredRepos = reposData;
            if (searchQuery) {
                filteredRepos = reposData.filter(repo => 
                    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
                );
            }
            
            updateAllRepos(filteredRepos);
            
        } catch (error) {
            showError(error.message, 'repos');
        } finally {
            showLoading(false, 'repos');
        }
    }
    
    function updatePinnedRepos(repos) {
        const pinnedReposContainer = document.getElementById('pinned-repos');
        pinnedReposContainer.innerHTML = '';
        
        if (repos.length === 0) {
            pinnedReposContainer.innerHTML = '<p>No repositories to display.</p>';
            return;
        }
        
        repos.forEach(repo => {
            const repoCard = document.createElement('div');
            repoCard.className = 'repo-card';
            repoCard.innerHTML = `
                <h3><a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a></h3>
                <p class="repo-description">${repo.description || 'No description provided.'}</p>
                <div class="repo-meta">
                    ${repo.language ? `<span><i class="fas fa-circle" style="color: ${getLanguageColor(repo.language)}"></i> ${repo.language}</span>` : ''}
                    <span><i class="fas fa-star"></i> ${repo.stargazers_count.toLocaleString()}</span>
                    <span><i class="fas fa-code-branch"></i> ${repo.forks_count.toLocaleString()}</span>
                </div>
            `;
            pinnedReposContainer.appendChild(repoCard);
        });
    }
    
    function updateAllRepos(repos) {
        const reposListContainer = document.getElementById('repos-list');
        reposListContainer.innerHTML = '';
        
        if (repos.length === 0) {
            reposListContainer.innerHTML = '<p>No repositories found matching your criteria.</p>';
            return;
        }
        
        repos.forEach(repo => {
            const repoItem = document.createElement('div');
            repoItem.className = 'repo-item';
            repoItem.innerHTML = `
                <h3><a href="${repo.html_url}" target="_blank" rel="noopener noreferrer">${repo.name}</a></h3>
                <p>${repo.description || 'No description provided.'}</p>
                <div class="repo-meta">
                    ${repo.language ? `<span><i class="fas fa-circle" style="color: ${getLanguageColor(repo.language)}"></i> ${repo.language}</span>` : ''}
                    <span><i class="fas fa-star"></i> ${repo.stargazers_count.toLocaleString()}</span>
                    <span><i class="fas fa-code-branch"></i> ${repo.forks_count.toLocaleString()}</span>
                    <span>Updated ${formatDate(repo.updated_at)}</span>
                </div>
            `;
            reposListContainer.appendChild(repoItem);
        });
    }
    
    function initContributionsChart() {
        const ctx = document.getElementById('contributions-chart').getContext('2d');
        
        // Destroy previous chart if it exists
        if (contributionsChart) {
            contributionsChart.destroy();
        }
        
        // This is a mock chart since GitHub's actual contribution data isn't publicly available via API
        contributionsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Contributions',
                    data: generateMockContributionsData(),
                    backgroundColor: [
                        '#ebedf0',
                        '#9be9a8',
                        '#40c463',
                        '#30a14e',
                        '#216e39'
                    ],
                    borderWidth: 0,
                    borderRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw} contributions`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function generateMockContributionsData() {
        return Array.from({length: 12}, () => Math.floor(Math.random() * 30));
    }
    
    function getLanguageColor(language) {
        // Simple mapping of language to colors
        const colors = {
            'JavaScript': '#f1e05a',
            'Python': '#3572A5',
            'Java': '#b07219',
            'TypeScript': '#2b7489',
            'Ruby': '#701516',
            'PHP': '#4F5D95',
            'C++': '#f34b7d',
            'C': '#555555',
            'Go': '#00ADD8',
            'Rust': '#dea584',
            'Swift': '#ffac45',
            'Kotlin': '#F18E33',
            'HTML': '#e34c26',
            'CSS': '#563d7c',
            'Shell': '#89e051'
        };
        
        return colors[language] || '#586069';
    }
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 0) return 'today';
        if (diffInDays === 1) return 'yesterday';
        if (diffInDays < 7) return `${diffInDays} days ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
        if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
        return `${Math.floor(diffInDays / 365)} years ago`;
    }
    
    function showLoading(show, context = 'all') {
        if (context === 'all') {
            const profileSections = document.querySelectorAll('.profile-sidebar, .main-content');
            profileSections.forEach(section => {
                section.style.display = show ? 'none' : '';
            });
            
            if (show) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading';
                loadingDiv.innerHTML = '<div class="spinner"></div>';
                document.querySelector('.main-container').appendChild(loadingDiv);
            } else {
                const loadingDiv = document.querySelector('.loading');
                if (loadingDiv) loadingDiv.remove();
            }
        } else if (context === 'repos') {
            const reposTab = document.getElementById('repos-tab');
            if (show) {
                reposTab.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            } else {
                // Content will be replaced by updateAllRepos
            }
        }
    }
    
    function showError(message, context = 'all') {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        if (context === 'all') {
            document.querySelector('.main-container').prepend(errorDiv);
        } else if (context === 'repos') {
            const reposTab = document.getElementById('repos-tab');
            reposTab.innerHTML = '';
            reposTab.appendChild(errorDiv);
        }
    }
    
    function clearErrors() {
        const errors = document.querySelectorAll('.error-message');
        errors.forEach(error => error.remove());
    }
    
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
});