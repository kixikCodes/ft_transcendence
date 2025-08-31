// Map routes to HTML files
const routes: { [path: string]: string } = {
    "/": "../pages/Home.html",
    "/dashboard": "../pages/Dashboard.html",
    404: "../pages/404.html",
};

// Receives the data-link href from the clicked element and adds it to the history
const navigateTo = (url: string): void => {
    window.history.pushState({}, "", url);
    handleLocation();
};

// After adding the data-link via navigateTo, the window.history.pathname is the new URL and
// the main-page div will be updated with the new content.
const handleLocation = async (): Promise<void> => {
    const path = window.location.pathname;
    const route = routes[path] || routes[404];

    try {
        const html = await fetch(route).then(res => res.text());
        const mainPage = document.getElementById("main-page");
        if (mainPage) {
            mainPage.innerHTML = html;
        }
    } catch (error) {
        console.error("Error loading page:", error);
    }
};

// Catch every click on data-link elements and retrieve the href from the <a> tag
document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-link]")) {
        e.preventDefault();
        const anchor = target as HTMLAnchorElement;
        const href = anchor.getAttribute("href");
        if (href) {
            navigateTo(href);
        }
    }
});

// When navigating with the browser's back/forward buttons, the history state will be updated
window.addEventListener("popstate", handleLocation);

// Call handleLocation on init to show "/", which is pointing to the home page
handleLocation();
