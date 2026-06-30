function getSelectedYear(){
    return localStorage.getItem("archeryscore_year") || "all";
}

function setSelectedYear(year){
    localStorage.setItem("archeryscore_year", year || "all");
}

function getYearFromDate(date){
    return String(date || "").slice(0,4);
}

function filterBySelectedYear(items){
    const year = getSelectedYear();

    if(year === "all"){
        return items || [];
    }

    return (items || []).filter(item => getYearFromDate(item.data) === year);
}

function yearsFromItems(items){
    const years = [...new Set((items || [])
        .map(item => getYearFromDate(item.data))
        .filter(Boolean))]
        .sort((a,b) => Number(b) - Number(a));

    return years;
}

function ensureYearFilter(items,onChange){
    const container =
        document.querySelector(".page-header") ||
        document.querySelector(".home-top-actions") ||
        document.body;

    let box = document.getElementById("yearFilterBox");

    if(!box){
        box = document.createElement("div");
        box.id = "yearFilterBox";
        box.className = "year-filter-box";
        box.innerHTML = `
            <label>Stagione</label>
            <select id="yearFilterSelect"></select>
        `;
        container.appendChild(box);
    }

    const select = document.getElementById("yearFilterSelect");
    const years = yearsFromItems(items);

    select.innerHTML = `
        <option value="all">Tutte</option>
        ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
    `;

    select.value = getSelectedYear();

    select.onchange = () => {
        setSelectedYear(select.value);
        if(typeof onChange === "function"){
            onChange();
        }
    };
}

function filteredFetchUrl(url){
    return url;
}
