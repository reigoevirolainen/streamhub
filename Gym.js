const app = {
    // Hoiab aktiivse harjutuse seeriaid (algselt tühi)
    sets: [],

    // Navigeerib vaadete vahel (id järgi) ja muudab all menüü aktiivseks
    navTo: function(viewId, bottomNavIndex = null) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        window.scrollTo(0,0);

        if (bottomNavIndex !== null) {
            const navItems = document.querySelectorAll('.bottom-nav .nav-item');
            navItems.forEach(b => b.classList.remove('active'));
            if(navItems[bottomNavIndex]) navItems[bottomNavIndex].classList.add('active');
        }
    },

    // Joonistab seeriate tabeli HTMLi uuesti (ILMA mahu arvutuseta)
    renderSets: function() {
        const tbody = document.getElementById('sets-body');
        tbody.innerHTML = '';

        this.sets.forEach((set, index) => {
            tbody.innerHTML += `
                <tr>
                    <td style="color: var(--neon); font-weight: 800; font-size: 16px;">${index + 1}</td>
                    <td><input type="number" class="set-input" placeholder="0" value="${set.weight}" onchange="app.updateSet(${index}, 'weight', this.value)"></td>
                    <td><input type="number" class="set-input" placeholder="0" value="${set.reps}" onchange="app.updateSet(${index}, 'reps', this.value)"></td>
                    <td><button class="btn-del" onclick="app.removeSet(${index})"><i class="fa-solid fa-xmark"></i></button></td>
                </tr>
            `;
        });
    },

    // Uuendab massiivis väärtust
    updateSet: function(index, field, value) {
        this.sets[index][field] = value; 
    },

    // Lisab uue seeria (kopeerib eelmise raskuse, aga jätab kordused tühjaks)
    addSet: function() {
        const lastSet = this.sets.length > 0 ? this.sets[this.sets.length - 1] : { weight: '', reps: '' };
        this.sets.push({ weight: lastSet.weight, reps: '' });
        this.renderSets();
    },

    // Kustutab seeria
    removeSet: function(index) {
        this.sets.splice(index, 1);
        this.renderSets();
    }
};

// Kui leht laeb, tekitame esimese tühja seeria ja renderdame tabeli
window.onload = function() {
    if (app.sets.length === 0) {
        app.sets.push({ weight: '', reps: '' });
    }
    app.renderSets();
};