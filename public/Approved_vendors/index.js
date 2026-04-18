import { db, auth } from "../authentication/config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/**
 * Main function to fetch approved shops from Firestore
 */
async function loadApprovedVendors() {
    const vendorGrid = document.getElementById("vendor-grid");
    if (!vendorGrid) {
        console.error("❌ [DOM Error] Could not find #vendor-grid element.");
        return;
    }

    try {
        console.log("🚀 [Firestore] Querying vendorApplications for 'Approved' status...");
        
        // Reference the collection confirmed in your screenshot
        const vRef = collection(db, "vendorApplications");
        
        // Query matches the "Approved" casing in your database screenshot
        const q = query(vRef, where("vendorStatus", "==", "Approved"));
        const querySnapshot = await getDocs(q);
        
        console.log(`📊 [Firestore] Success! Found ${querySnapshot.size} shop(s).`);

        const approvedVendors = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Mapping fields to match your Firestore schema exactly
            approvedVendors.push({
                uid: data.uid || doc.id,
                name: data.vendorBusinessName || "Unnamed Store", 
                location: data.vendorLocation || "Wits Campus",
                description: data.vendorDescription || "No description provided.",
                foodType: data.vendorFoodType || "Food",
                logoUrl: data.logoUrl || "" 
            });
        });

        renderVendorList(approvedVendors);
    } catch (error) {
        console.error("❌ [Firestore Error] Fetch failed:", error.message);
        renderVendorList([]); // Fallback to placeholders
    }
}

/**
 * Renders the vendor cards into the grid
 */
function renderVendorList(vendors) {
    const vendorGrid = document.getElementById("vendor-grid");
    vendorGrid.innerHTML = ""; // Clear loading state

    // 1. Render actual shops from DB
    vendors.forEach((vendor) => {
        const listItem = document.createElement("li");
        listItem.style.listStyle = "none";
        listItem.innerHTML = createCardHTML(vendor, false);
        vendorGrid.appendChild(listItem);
    });

    // 2. Fill with "Coming Soon" placeholders up to a minimum of 4 cards
    const minCards = 4;
    for (let i = vendors.length; i < minCards; i++) {
        const placeholderItem = document.createElement("li");
        placeholderItem.style.listStyle = "none";
        placeholderItem.innerHTML = createCardHTML({
            name: "Coming Soon",
            location: "Wits Campus",
            description: "New vendor application under review.",
            foodType: "TBA"
        }, true);
        vendorGrid.appendChild(placeholderItem);
    }
}

/**
 * Card Template Logic - Optimized for 2-column grid
 */
function createCardHTML(data, isPlaceholder) {
    const opacity = isPlaceholder ? "0.6" : "1";
    const statusColor = isPlaceholder ? "#888" : "#2e7d32";
    
    // Note: width is 100% so it fills the grid column defined in CSS
    return `
        <article class="vendor-card" style="border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; display: flex; flex-direction: column; opacity: ${opacity}; transition: transform 0.2s ease-in-out;">
            <div class="vendor-logo-container" style="background: #f4f4f4; height: 140px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #eee;">
                <img src="${data.logoUrl || 'https://via.placeholder.com/150?text=Vendor'}" 
                     alt="logo" 
                     style="max-height: 90px; max-width: 90px; object-fit: contain;">
            </div>
            
            <div class="card-content" style="padding: 20px; flex-grow: 1;">
                <h2 style="margin: 0 0 4px 0; font-size: 1.25rem; color: #003b5c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.name}</h2>
                <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: #d32f2f; font-weight: 600;">
                    📍 ${data.location}
                </p>
                <p style="color: #555; font-size: 0.85rem; line-height: 1.4; margin-bottom: 15px; height: 40px; overflow: hidden;">
                    ${data.description}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 10px;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: ${statusColor};">
                        ● ${isPlaceholder ? 'Pending' : 'Open'}
                    </span>
                    <span style="font-size: 0.75rem; color: #888; background: #eee; padding: 2px 8px; border-radius: 10px;">${data.foodType}</span>
                </div>
            </div>
            <div style="padding: 15px; background: #fafafa; border-top: 1px solid #eee;">
                ${isPlaceholder ? 
                    `<button disabled style="width: 100%; background: #ccc; color: white; padding: 10px; border-radius: 6px; border: none; cursor: not-allowed;">Unavailable</button>` : 
                    `<a href="menu.html?vendorId=${data.uid}" style="display: block; text-align: center; background: #003b5c; color: white; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Menu</a>`
                }
            </div>
        </article>
    `;
}

/**
 * Listener to ensure user is logged in before fetching data
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("👤 [Auth] User detected:", user.email);
        loadApprovedVendors();
    } else {
        console.warn("🚫 [Auth] No user logged in. Redirecting to login...");
        // Redirect to login if not authenticated
        // window.location.href = "../authentication/login.html"; 
    }
});