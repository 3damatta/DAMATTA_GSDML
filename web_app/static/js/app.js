document.addEventListener("DOMContentLoaded", () => {
    // Referências aos elementos da DOM
    const canvas = document.getElementById("roi-canvas");
    const ctx = canvas.getContext("2d");
    
    const recipeSelect = document.getElementById("recipe-select");
    const recipeNameInput = document.getElementById("recipe-name");
    
    const hMinSlider = document.getElementById("h-min");
    const hMaxSlider = document.getElementById("h-max");
    const sMinSlider = document.getElementById("s-min");
    const sMaxSlider = document.getElementById("s-max");
    const vMinSlider = document.getElementById("v-min");
    const vMaxSlider = document.getElementById("v-max");

    const valHMin = document.getElementById("val-h-min");
    const valHMax = document.getElementById("val-h-max");
    const valSMin = document.getElementById("val-s-min");
    const valSMax = document.getElementById("val-s-max");
    const valVMin = document.getElementById("val-v-min");
    const valVMax = document.getElementById("val-v-max");

    const minCountInput = document.getElementById("min-count");
    const maxCountInput = document.getElementById("max-count");

    const btnSave = document.getElementById("btn-save-recipe");
    const btnApply = document.getElementById("btn-apply-recipe");
    const btnDrawRoi = document.getElementById("btn-draw-roi");
    const btnClearRoi = document.getElementById("btn-clear-roi");

    // Estado da ROI
    let currentRoi = [50, 50, 540, 380];
    let isDrawing = false;
    let startX = 0, startY = 0;

    // Atualização de rótulos dos Sliders
    function updateSliderLabels() {
        valHMin.textContent = hMinSlider.value;
        valHMax.textContent = hMaxSlider.value;
        valSMin.textContent = sMinSlider.value;
        valSMax.textContent = sMaxSlider.value;
        valVMin.textContent = vMinSlider.value;
        valVMax.textContent = vMaxSlider.value;
    }

    [hMinSlider, hMaxSlider, sMinSlider, sMaxSlider, vMinSlider, vMaxSlider].forEach(slider => {
        slider.addEventListener("input", updateSliderLabels);
    });

    // Desenho de ROI Interativo no Canvas
    function drawCanvasOverlay() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentRoi && currentRoi.length === 4) {
            const [x, y, w, h] = currentRoi;
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
            ctx.fillRect(x, y, w, h);
        }
    }

    canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawing = true;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;
        
        const x = Math.min(startX, currX);
        const y = Math.min(startY, currY);
        const w = Math.abs(currX - startX);
        const h = Math.abs(currY - startY);

        currentRoi = [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
        drawCanvasOverlay();
    });

    canvas.addEventListener("mouseup", () => {
        isDrawing = false;
    });

    btnClearRoi.addEventListener("click", () => {
        currentRoi = [0, 0, 640, 480];
        drawCanvasOverlay();
    });

    // Carregar Receitas da API REST
    async function loadRecipes() {
        try {
            const res = await fetch("/api/recipes");
            const recipes = await res.json();
            recipeSelect.innerHTML = "";
            for (const [id, r] of Object.entries(recipes)) {
                const opt = document.createElement("option");
                opt.value = id;
                opt.textContent = `#${id} - ${r.name}`;
                recipeSelect.appendChild(opt);
            }
            if (Object.keys(recipes).length > 0) {
                populateRecipeForm(recipes[Object.keys(recipes)[0]]);
            }
        } catch (err) {
            console.error("Erro ao carregar receitas:", err);
        }
    }

    function populateRecipeForm(recipe) {
        recipeNameInput.value = recipe.name || "";
        hMinSlider.value = recipe.hsv_min ? recipe.hsv_min[0] : 0;
        sMinSlider.value = recipe.hsv_min ? recipe.hsv_min[1] : 50;
        vMinSlider.value = recipe.hsv_min ? recipe.hsv_min[2] : 50;

        hMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[0] : 180;
        sMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[1] : 255;
        vMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[2] : 255;

        minCountInput.value = recipe.min_count !== undefined ? recipe.min_count : 1;
        maxCountInput.value = recipe.max_count !== undefined ? recipe.max_count : 10;

        if (recipe.roi && recipe.roi.length === 4) {
            currentRoi = recipe.roi;
            drawCanvasOverlay();
        }
        updateSliderLabels();
    }

    recipeSelect.addEventListener("change", async (e) => {
        const id = e.target.value;
        const res = await fetch("/api/recipes");
        const recipes = await res.json();
        if (recipes[id]) {
            populateRecipeForm(recipes[id]);
        }
    });

    // Salvar Receita
    btnSave.addEventListener("click", async () => {
        const recipeId = recipeSelect.value || "1";
        const payload = {
            id: recipeId,
            name: recipeNameInput.value,
            hsv_min: [parseInt(hMinSlider.value), parseInt(sMinSlider.value), parseInt(vMinSlider.value)],
            hsv_max: [parseInt(hMaxSlider.value), parseInt(sMaxSlider.value), parseInt(vMaxSlider.value)],
            min_count: parseInt(minCountInput.value),
            max_count: parseInt(maxCountInput.value),
            roi: currentRoi,
        };

        const res = await fetch("/api/recipes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Receita salva com sucesso!");
            loadRecipes();
        }
    });

    // Ativar Receita Manualmente
    btnApply.addEventListener("click", async () => {
        const recipeId = recipeSelect.value;
        const res = await fetch(`/api/recipes/select/${recipeId}`, { method: "POST" });
        if (res.ok) {
            alert(`Receita #${recipeId} ativada!`);
        }
    });

    // Polling de Telemetria PROFINET (100ms)
    async function updateTelemetry() {
        try {
            const res = await fetch("/api/status");
            const data = await res.json();

            const inp = data.inputs_profinet;
            const out = data.outputs_profinet;

            document.getElementById("val-status-flags").textContent = "0x" + inp.status_flags.toString(16).padStart(4, '0').toUpperCase();
            document.getElementById("val-class-id").textContent = inp.class_id;
            document.getElementById("val-object-count").textContent = inp.object_count;
            document.getElementById("val-pos-x").textContent = inp.pos_x_mm.toFixed(2);
            document.getElementById("val-pos-y").textContent = inp.pos_y_mm.toFixed(2);
            document.getElementById("val-angle").textContent = inp.angle_deg.toFixed(2) + "°";
            document.getElementById("val-trigger-cmd").textContent = out.trigger_cmd;
            document.getElementById("val-active-recipe").textContent = inp.active_recipe;
            document.getElementById("val-heartbeat").textContent = data.heartbeat;

            // Badges
            const isReady = (inp.status_flags & (1 << 0)) !== 0;
            const isTarget = (inp.status_flags & (1 << 1)) !== 0;
            const isPass = (inp.status_flags & (1 << 2)) !== 0;

            document.getElementById("badge-ready").className = "badge " + (isReady ? "active-blue" : "");
            document.getElementById("badge-target").className = "badge " + (isTarget ? "active-blue" : "");
            document.getElementById("badge-pass").className = "badge " + (isPass ? "active-green" : "active-red");
            document.getElementById("badge-pass").querySelector("span").nextSibling.textContent = isPass ? " PASS (OK)" : " FAIL (NOK)";

        } catch (err) {
            // backend desconectado temporariamente
        }
    }

    loadRecipes();
    setInterval(updateTelemetry, 100);
});
