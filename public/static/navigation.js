document.addEventListener("DOMContentLoaded", function() {
    // Populate the navigation bar in the HTML
    const navigationContainer = document.getElementById('navigation');
    if (navigationContainer) {
        navigationContainer.innerHTML = `
            <div class="navbar">
                <a href="/home" data-section="home">Home</a>
                <a href="/products" data-section="products">Products</a>
                <a href="/bundles" data-section="bundles">Bundles</a>
            </div>
        `;
    }

    // Handle in-app navigation
    document.querySelectorAll('.navbar a').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior

            // Get the target section to show
            const section = e.target.getAttribute('data-section');
            showSection(section);
        });
    });

    // Function to show the appropriate section based on navigation click
    function showSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach((sec) => {
            sec.style.display = 'none';
        });

        // Show the selected section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
    }

    // Show the home section by default
    showSection('home');
});
