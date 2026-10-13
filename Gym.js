let toastTimeout;
let globalTotalVolume = 0;
let sets = [
    { weight: 60, reps: 12 },
    { weight: 80, reps: 10 }
];

// Teavituste (Toast) näitamine
function showToast(message) {
    const toast = document.getElementById('demo-toast');
    toast.innerText = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// Kategooriate visuaalne vahetamine
function switchCategory(element) {
    const children = document.getElementById('cat-list').children;
    for(let i=0; i<children.length; i++) children[i].classList.remove('active');
    element.classList.add('active');
    showToast('Filtreerin: ' + element.innerText);
}

function switchTab(element, parentId) {
    const children = document.getElementById(parentId).children;
    for(let i=0; i<children.length; i++) children[i].classList.remove('active');
    element.classList.add('active');
}

// Vaadete vahel liikumine
function navTo(viewId, navBtn = null) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo(0,0);

    if (navBtn) {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        navBtn.classList.add('active');
    } else if (viewId === 'view-home') {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(b => b.classList.remove('active'));
        navItems[0].classList.add('active');
    }
}

// Masina lehe avamine
function openMachine() {
    navTo('view-machine');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
}

// Seeriate tabeli renderdamine ja kalkuleerimine
function renderSets() {
    const tbody = document.getElementById('sets-body');
    tbody.innerHTML = '';
    globalTotalVolume = 0;

    sets.forEach((set, index) => {
        const vol = set.weight * set.reps;
        globalTotalVolume += vol;
        
        tbody.innerHTML += `
            <tr>
                <td style="color: var(--text-muted);">${index + 1}</td>
                <td><input type="number" class="set-input" value="${set.weight}" onchange="updateSet(${index}, 'weight', this.value)"></td>
                <td><input type="number" class="set-input" value="${set.reps}" onchange="updateSet(${index}, 'reps', this.value)"></td>
                <td style="font-weight: 600;">${vol}</td>
                <td><button class="del-btn" onclick="removeSet(${index})"><i class="fa-regular fa-trash-can"></i></button></td>
            </tr>
        `;
    });

    document.getElementById('total-vol').innerText = globalTotalVolume;
}

function updateSet(index, field, value) {
    sets[index][field] = Number(value);
    renderSets();
}

function addSet() {
    const lastSet = sets.length > 0 ? sets[sets.length - 1] : { weight: 0, reps: 0 };
    sets.push({ weight: lastSet.weight, reps: lastSet.reps });
    renderSets();
}

function removeSet(index) {
    sets.splice(index, 1);
    renderSets();
}

// Treeningu salvestamine, edastab info kokkuvõtte vaatesse
function saveWorkout() {
    // Siin toimuks reaalses maailmas SQL andmebaasi kirjutamine (näiteks fetch(POST /api/workout))
    navTo('view-workout');
    document.querySelectorAll('.nav-item').forEach((b, i) => {
        b.classList.remove('active');
        if(i === 1) b.classList.add('active');
    });
    
    // Uuendame kokkuvõtte vaate mahtu
    document.getElementById('final-vol').innerText = globalTotalVolume + ' kg';
    showToast('Harjutus edukalt salvestatud!');
}

function exportPDF() {
    showToast('Valmistan PDF faili...');
    setTimeout(() => { window.print(); }, 1000);
}

// Käivita tabel lehe laadimisel
window.onload = renderSets;