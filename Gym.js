const app = {
    // Andmed seeriate tabeli jaoks
    sets: [
        { weight: 60, reps: 12 },
        { weight: 80, reps: 10 },
        { weight: 100, reps: 8 },
        { weight: 100, reps: 6 }
    ],

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

    // Joonistab seeriate tabeli HTMLi uuesti
    renderSets: function() {
        const tbody = document.getElementById('sets-body');
        tbody.innerHTML = '';
        let totalVolume = 0;

        this.sets.forEach((set, index) => {
            const vol = set.weight * set.reps;
            totalVolume += vol;
            
            tbody.innerHTML += `
                <tr>
                    <td style="color: var(--text-muted);">${index + 1}</td>
                    <td><input type="number" class="set-input" value="${set.weight}" onchange="app.updateSet(${index}, 'weight', this.value)"></td>
                    <td><input type="number" class="set-input" value="${set.reps}" onchange="app.updateSet(${index}, 'reps', this.value)"></td>
                    <td style="font-weight: 600; color: #fff;">${vol}</td>
                    <td><button class="del-btn" onclick="app.removeSet(${index})"><i class="fa-regular fa-trash-can"></i></button></td>
                </tr>
            `;
        });

        document.getElementById('total-vol').innerText = totalVolume;
    },

    // Uuendab massiivis väärtust ja renderdab
    updateSet: function(index, field, value) {
        this.sets[index][field] = Number(value);
        this.renderSets();
    },

    // Lisab uue seeria (kopeerib eelmise andmed)
    addSet: function() {
        const lastSet = this.sets.length > 0 ? this.sets[this.sets.length - 1] : { weight: 0, reps: 0 };
        this.sets.push({ weight: lastSet.weight, reps: lastSet.reps });
        this.renderSets();
    },

    // Kustutab seeria
    removeSet: function(index) {
        this.sets.splice(index, 1);
        this.renderSets();
    }
};

// Kui fail (leht) laeb, käivita seeriate renderdamine
window.onload = function() {
    app.renderSets();
};