import { clearRoadNetwork } from "./roadnetwork_handler.js";
import { loadRoadNetwork } from "./roadnetwork_handler.js";
import { roadNetwork } from "./roadnetwork_handler.js";

export async function loadIntersection(name, sceneManager) {
    try {
        const res = await fetch(`/api/intersections/${name}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        console.log("Loaded intersection:", data);
        const scene = sceneManager.getScene();
        clearRoadNetwork(sceneManager);
        roadNetwork.Approaches.length = 0;

        // Load roadnetwork and satellite image
        sceneManager.loadSatelliteImage(data.satellite_image);
        await loadRoadNetwork(sceneManager.getScene(), data.roadnet);
    } catch (err) {
        console.error("Error loading intersection", err);
    }
}

export async function createIntersection(name, lat, lon, form, dropdown, sceneManager) {
    try {
        showSatelliteModal();
        const res = await fetch("/api/intersections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, lat, lon }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to create");
        }
        const data = await res.json();
        console.log("Created intersection:", data);
        form.style.display = "none";
        await refreshDropdown(dropdown);
        dropdown.value = name;

    } catch (err) {
        console.error("Error creating intersection", err);
        alert("Failed to create intersection: " + err.message);
    }
    finally {
        loadIntersection(name,sceneManager)
        hideSatelliteModal();
    }

}

export const refreshDropdown = async (dropdown) => {
    dropdown.innerHTML = `<option value="">-- Select Intersection --</option>`;
    try {
        const res = await fetch("/api/intersections");
        const data = await res.json();
        data.intersections.forEach((name) => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            dropdown.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to fetch intersections", err);
    }
};

function showSatelliteModal() {
    document.getElementById("satelliteModal").classList.remove("hidden");
}

function hideSatelliteModal() {
    document.getElementById("satelliteModal").classList.add("hidden");
}