function syncFetchSubsolarPoint() {
    const now = new Date();
    const delay = 1000 - now.getMilliseconds();
    setTimeout(() => {
        fetchSubsolarPoint();
        setInterval(fetchSubsolarPoint, 1000);
    }, delay);
}

function fetchSubsolarPoint() {
    fetch("/subsolar-point").then(response => response.json()).then(
        data => {
            const ssp = document.getElementById("position");
            ssp.textContent = `${data[0].toFixed(4)}, ${data[1].toFixed(4)}`;
        }
    )
    .catch(error => console.error("Error fetching subsolar point: ", error));
}

syncFetchSubsolarPoint();