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
        
        const vRef = collection(db, "vendorApplications");
        const q = query(vRef, where("vendorStatus", "==", "Approved"));
        const querySnapshot = await getDocs(q);
        
        console.log(`📊 [Firestore] Success! Found ${querySnapshot.size} shop(s).`);

        const approvedVendors = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            approvedVendors.push({
                uid: doc.id,
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
        renderVendorList([]); 
    }
}

/**
 * Renders the vendor cards into the grid
 */
function renderVendorList(vendors) {
    const vendorGrid = document.getElementById("vendor-grid");
    vendorGrid.innerHTML = ""; 

    vendors.forEach((vendor) => {
        const listItem = document.createElement("li");
        listItem.style.listStyle = "none";
        listItem.innerHTML = createCardHTML(vendor, false);
        vendorGrid.appendChild(listItem);
    });

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
 * Card Template Logic - Uses Semantic HTML (No Divs)
 */
function createCardHTML(data, isPlaceholder) {
    const opacity = isPlaceholder ? "0.6" : "1";
    const statusColor = isPlaceholder ? "#888" : "#2e7d32";
    
    return `
        <article class="vendor-card" style="border: 1px solid #ddd; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 300px; display: flex; flex-direction: column; opacity: ${opacity};">
            
            <header class="vendor-logo-container" style="background: #f4f4f4; height: 140px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #eee;">
                <img src="${data.logoUrl || 'https://via.placeholder.com/150?text=Vendor'}" 
                     alt="logo" 
                     style="max-height: 90px; max-width: 90px; object-fit: contain;">
            </header>
            
            <section class="card-content" style="padding: 20px; flex-grow: 1; display: block;">
                <h2 style="margin: 0 0 4px 0; font-size: 1.25rem; color: #003b5c;">${data.name}</h2>
                <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: #d32f2f; font-weight: 600;">
                    📍 ${data.location}
                </p>
                <p style="color: #555; font-size: 0.85rem; line-height: 1.4; margin-bottom: 15px; height: 40px; overflow: hidden;">
                    ${data.description}
                </p>
                <footer style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 10px;">
                    <span style="font-size: 0.8rem; font-weight: bold; color: ${statusColor};">
                        ● ${isPlaceholder ? 'Pending' : 'Open'}
                    </span>
                    <span style="font-size: 0.75rem; color: #888; background: #eee; padding: 2px 8px; border-radius: 10px;">${data.foodType}</span>
                </footer>
            </section>

            <aside style="padding: 15px; background: #fafafa; border-top: 1px solid #eee; display: block;">
                ${isPlaceholder ? 
                    `<button disabled style="width: 100%; background: #ccc; color: white; padding: 10px; border-radius: 6px; border: none; cursor: not-allowed;">Unavailable</button>` : 
                    `<a href="../customer/menu.html?vendorId=${data.uid}" style="display: block; text-align: center; background: #003b5c; color: white; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Menu</a>`
                }
            </aside>
            
        </article>
    `;
}

/**
 * Ensure the user is logged in before allowing the fetch
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadApprovedVendors();
    } else {
        console.warn("User not logged in. Redirecting...");
        // loadApprovedVendors(); // Uncomment for local testing without auth
    }
});