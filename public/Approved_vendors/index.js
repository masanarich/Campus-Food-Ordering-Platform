/**
 * Renders each vendor into its own individual card with logo and location.
 */
function renderVendorList(vendors) {
    const vendorGrid = document.getElementById("vendor-grid");
    const statusMessage = document.getElementById("vendor-status-message");

    if (!vendorGrid || !statusMessage) return;

    vendorGrid.innerHTML = "";
    statusMessage.textContent = "";

    if (!vendors || vendors.length === 0) {
        statusMessage.textContent = "No approved vendors found at the moment.";
        return;
    }

    vendors.forEach((vendor) => {
        const listItem = document.createElement("li");
        
        listItem.innerHTML = `
            <article class="vendor-card" style="border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); list-style: none; width: 300px; display: flex; flex-direction: column; font-family: sans-serif;">
                <div class="vendor-logo-container" style="background: #f4f4f4; height: 140px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #eee;">
                    <img src="${vendor.logoUrl || 'https://via.placeholder.com/150?text=Logo'}" 
                         alt="${vendor.name} logo" 
                         style="max-height: 90px; max-width: 90px; object-fit: contain;">
                </div>
                
                <div class="card-content" style="padding: 20px; flex-grow: 1;">
                    <h2 class="vendor-name" style="margin: 0 0 4px 0; font-size: 1.25rem; color: #003b5c;">${vendor.name}</h2>
                    
                    <p class="vendor-location" style="margin: 0 0 12px 0; font-size: 0.85rem; color: #d32f2f; font-weight: 600; display: flex; align-items: center;">
                        <span style="margin-right: 5px;">📍</span> ${vendor.location}
                    </p>

                    <p class="vendor-description" style="color: #555; font-size: 0.85rem; line-height: 1.4; margin-bottom: 15px; height: 40px; overflow: hidden;">
                        ${vendor.description}
                    </p>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 10px;">
                        <span style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: ${vendor.trading === 'Open' ? '#2e7d32' : '#d32f2f'};">
                            ● ${vendor.trading}
                        </span>
                        <span style="font-size: 0.75rem; color: #888; background: #eee; padding: 2px 8px; border-radius: 10px;">${vendor.foodType}</span>
                    </div>
                </div>

                <div class="card-actions" style="padding: 15px; background: #fafafa; border-top: 1px solid #eee;">
                    <a href="menu.html?vendorId=${vendor.id}" class="view-menu-btn" style="display: block; text-align: center; background: #003b5c; color: white; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: background 0.3s;">
                        View Menu
                    </a>
                </div>
            </article>
        `;
        
        vendorGrid.appendChild(listItem);
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { renderVendorList };
}

if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", () => {
        const browserMockShops = [
            {
                id: "wits_canteen_01",
                name: "The Matrix Canteen",
                location: "Matrix, East Campus",
                description: "The heart of campus dining. Hearty breakfast plates and daily student deals.",
                trading: "Open",
                foodType: "Buffet",
                logoUrl: "https://via.placeholder.com/150/003b5c/FFFFFF?text=Matrix"
            },
            {
                id: "boerie_roll_02",
                name: "The Boerie King",
                location: "Main Library Walk",
                description: "Authentic street food. Freshly grilled boerewors rolls with caramelized onions.",
                trading: "Open",
                foodType: "Street Food",
                logoUrl: "https://via.placeholder.com/150/E65100/FFFFFF?text=Boerie"
            },
            {
                id: "west_diner_03",
                name: "West Campus Diner",
                location: "FNB Building, West Campus",
                description: "A cozy spot for coffee lovers and light lunch seekers. Best toasted sandwiches!",
                trading: "Closed",
                foodType: "Cafe",
                logoUrl: "https://via.placeholder.com/150/4E342E/FFFFFF?text=Diner"
            },
            {
                id: "varsity_pizza_04",
                name: "Varsity Pizza",
                location: "The Junction",
                description: "Hot, cheesy, and fast. Perfect for late-night study sessions or group projects.",
                trading: "Open",
                foodType: "Pizza",
                logoUrl: "https://via.placeholder.com/150/C62828/FFFFFF?text=Pizza"
            },
            {
                id: "green_bowl_05",
                name: "The Green Bowl",
                location: "Science Stadium",
                description: "Fresh salads, smoothies, and vegan-friendly options for the health-conscious.",
                trading: "Open",
                foodType: "Healthy",
                logoUrl: "https://via.placeholder.com/150/2E7D32/FFFFFF?text=Green"
            }
        ];

        const grid = document.getElementById("vendor-grid");
        if(grid) {
            grid.style.display = "flex";
            grid.style.flexWrap = "wrap";
            grid.style.gap = "25px";
            grid.style.padding = "30px";
            grid.style.justifyContent = "center";
            grid.style.listStyle = "none";
            grid.style.margin = "0 auto";
            grid.style.maxWidth = "1200px";
        }

        renderVendorList(browserMockShops);
    });
}