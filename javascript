"use strict";

const $ = (id) => document.getElementById(id);

let photoSelected = false;
let locationData = null;
let latestReport = null;

const currentYear = new Date().getFullYear();

function showMessage(message) {
  $("message").textContent = message;
}

function getYear(id) {
  const value = $(id).value.trim();

  if (value === "") return null;

  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < 1800 ||
    year > currentYear
  ) {
    throw new Error(
      `Enter a valid year between 1800 and ${currentYear}.`
    );
  }

  return year;
}

// Photo upload and preview
$("photo").addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showMessage("Please select an image file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    $("preview").src = reader.result;
    $("preview").hidden = false;
    photoSelected = true;

    showMessage(
      "Photo loaded. Automatic AI analysis is not connected yet."
    );
  };

  reader.onerror = () => {
    showMessage("Could not read the selected image.");
  };

  reader.readAsDataURL(file);
});

// Request GPS permission
$("getLocation").addEventListener("click", () => {
  if (!navigator.geolocation) {
    $("locationStatus").textContent =
      "GPS is unavailable. Enter coordinates manually.";
    return;
  }

  $("locationStatus").textContent =
    "Waiting for location permission...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationData = {
        latitude: Number(
          position.coords.latitude.toFixed(6)
        ),
        longitude: Number(
          position.coords.longitude.toFixed(6)
        ),
        accuracyMeters: Math.round(
          position.coords.accuracy
        )
      };

      updateLocation();
    },
    (error) => {
      const messages = {
        1: "Location permission denied.",
        2: "Location unavailable.",
        3: "Location request timed out."
      };

      $("locationStatus").textContent =
        (messages[error.code] || "Could not get location.") +
        " Try entering coordinates manually.";
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    }
  );
});

function updateLocation() {
  if (!locationData) return;

  $("locationStatus").textContent =
    `Location: ${locationData.latitude}, ` +
    `${locationData.longitude}` +
    (locationData.accuracyMeters
      ? ` (accuracy about ${locationData.accuracyMeters} m)`
      : " (manual coordinates)");

  $("coordinateResult").textContent =
    `${locationData.latitude}, ${locationData.longitude}`;
}

// Manual coordinate entry
$("toggleManual").addEventListener("click", () => {
  $("manualLocation").hidden = !$("manualLocation").hidden;
});

$("saveLocation").addEventListener("click", () => {
  const latitude = Number($("latitude").value);
  const longitude = Number($("longitude").value);

  if (
    $("latitude").value.trim() === "" ||
    $("longitude").value.trim() === "" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    $("locationStatus").textContent =
      "Enter valid latitude and longitude.";
    return;
  }

  locationData = {
    latitude,
    longitude,
    accuracyMeters: null
  };

  updateLocation();
});

// Generate evidence report
$("analyze").addEventListener("click", () => {
  try {
    const builtYear = getYear("builtYear");
    const absentYear = getYear("absentYear");
    const seenYear = getYear("seenYear");

    if (
      absentYear !== null &&
      seenYear !== null &&
      absentYear >= seenYear
    ) {
      throw new Error(
        "The last-absent year must be earlier than the first-present year."
      );
    }

    if (
      builtYear !== null &&
      seenYear !== null &&
      builtYear > seenYear
    ) {
      throw new Error(
        "The construction year cannot be later than the first-present year."
      );
    }

    if (
      builtYear !== null &&
      absentYear !== null &&
      builtYear <= absentYear
    ) {
      throw new Error(
        "Check your dates: the building cannot have been built before a year when it was absent."
      );
    }

    let ageEstimate = "Unknown";
    let constructionDuration = "Unknown";
    const timeline = [];

    // A documented year is only as reliable as its source.
    if (builtYear !== null) {
      ageEstimate =
        `About ${currentYear - builtYear} years ` +
        "(based on entered construction year)";

      timeline.push({
        year: builtYear,
        event: "Construction year entered by user"
      });
    } else if (seenYear !== null) {
      ageEstimate =
        `At least ${currentYear - seenYear} years ` +
        "since the first-present evidence";
    }

    // Historical presence/absence narrows a possible interval.
    if (absentYear !== null) {
      timeline.push({
        year: absentYear,
        event: "Last reported absent"
      });
    }

    if (seenYear !== null) {
      timeline.push({
        year: seenYear,
        event: "First reported present"
      });
    }

    if (
      absentYear !== null &&
      seenYear !== null &&
      builtYear === null
    ) {
      constructionDuration =
        `Construction occurred sometime after ${absentYear} ` +
        `and by ${seenYear}; actual duration unknown`;
    }

    timeline.sort((a, b) => a.year - b.year);

    if (timeline.length === 0) {
      timeline.push({
        year: null,
        event: "No dated historical evidence entered"
      });
    }

    $("reportPlace").textContent =
      $("place").value.trim() || "Unnamed building";

    $("ageResult").textContent = ageEstimate;
    $("durationResult").textContent = constructionDuration;

    $("coordinateResult").textContent = locationData
      ? `${locationData.latitude}, ${locationData.longitude}`
      : "Unknown";

    $("evidenceResult").textContent =
      seenYear !== null
        ? `Present by ${seenYear}`
        : builtYear !== null
          ? `Construction year: ${builtYear}`
          : "None entered";

    // Build timeline safely without inserting user text as HTML.
    $("timeline").replaceChildren();

    timeline.forEach((item) => {
      const entry = document.createElement("p");

      entry.textContent = item.year === null
        ? `• ${item.event}`
        : `• ${item.year} — ${item.event}`;

      $("timeline").appendChild(entry);
    });

    latestReport = {
      project: "TimeTrace",
      generatedAt: new Date().toISOString(),
      building: $("place").value.trim() || null,
      photoSelected,
      coordinates: locationData,
      estimatedAge: ageEstimate,
      constructionDuration,
      constructionYear: builtYear,
      lastAbsentYear: absentYear,
      firstPresentYear: seenYear,
      sourceNotes: $("source").value.trim() || null,
      timeline,
      limitations: [
        "This is a rules-based report, not AI age prediction.",
        "Dates are user-supplied and are not independently verified.",
        "First-present imagery does not establish the construction date.",
        "Construction duration requires evidence of both start and completion."
      ]
    };

    showMessage("Report generated successfully.");
  } catch (error) {
    showMessage(error.message);
  }
});

// Download JSON report
$("download").addEventListener("click", () => {
  if (!latestReport) {
    showMessage("Generate a report first.");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(latestReport, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "timetrace-report.json";
  link.click();

  URL.revokeObjectURL(url);
});

// Copy report summary
$("copy").addEventListener("click", async () => {
  if (!latestReport) {
    showMessage("Generate a report first.");
    return;
  }

  const summary = [
    "TimeTrace Building Report",
    `Building: ${latestReport.building || "Unknown"}`,
    `Estimated age: ${latestReport.estimatedAge}`,
    `Construction duration: ${latestReport.constructionDuration}`,
    `Coordinates: ${
      locationData
        ? `${locationData.latitude}, ${locationData.longitude}`
        : "Unknown"
    }`,
    `Source notes: ${latestReport.sourceNotes || "None"}`,
    "Dates have not been independently verified."
  ].join("\n");

  try {
    await navigator.clipboard.writeText(summary);
    showMessage("Report summary copied.");
  } catch {
    showMessage(
      "Copying is unavailable in this browser. Download the JSON report instead."
    );
  }
});

// Reset the form
$("reset").addEventListener("click", () => {
  $("photo").value = "";
  $("place").value = "";
  $("latitude").value = "";
  $("longitude").value = "";
  $("builtYear").value = "";
  $("absentYear").value = "";
  $("seenYear").value = "";
  $("source").value = "";

  $("preview").removeAttribute("src");
  $("preview").hidden = true;
  $("manualLocation").hidden = true;

  photoSelected = false;
  locationData = null;
  latestReport = null;

  $("locationStatus").textContent = "Location not added.";
  $("reportPlace").textContent = "No building selected.";
  $("ageResult").textContent = "Unknown";
  $("durationResult").textContent = "Unknown";
  $("coordinateResult").textContent = "Unknown";
  $("evidenceResult").textContent = "None entered";
  $("timeline").textContent =
    "Add historical evidence to start your timeline.";

  showMessage("Form reset.");
});
