document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // NAVEGAÇÃO DE ABAS
    // =========================================================================
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            tabButtons.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
        });
    });

    // =========================================================================
    // ELEMENTOS DA DOM DA ABA 1 (VISÃO E CALIBRAÇÃO)
    // =========================================================================
    const canvas = document.getElementById("roi-canvas");
    const ctx = canvas.getContext("2d");

    const recipeSelect = document.getElementById("recipe-select");
    const recipeNameInput = document.getElementById("recipe-name");
    const recipeDescInput = document.getElementById("recipe-desc");
    const recipeClassSelect = document.getElementById("recipe-class-id");
    
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

    const recipeMinAreaInput = document.getElementById("recipe-min-area");
    const recipeMaxAreaInput = document.getElementById("recipe-max-area");
    const minCountInput = document.getElementById("min-count");
    const maxCountInput = document.getElementById("max-count");

    const roiXInput = document.getElementById("roi-x");
    const roiYInput = document.getElementById("roi-y");
    const roiWInput = document.getElementById("roi-w");
    const roiHInput = document.getElementById("roi-h");

    const btnSaveRecipe = document.getElementById("btn-save-recipe");
    const btnApplyRecipe = document.getElementById("btn-apply-recipe");
    const btnNewRecipe = document.getElementById("btn-new-recipe");
    const btnDeleteRecipe = document.getElementById("btn-delete-recipe");
    const btnTestTrigger = document.getElementById("btn-test-trigger");

    const btnDrawRoi = document.getElementById("btn-draw-roi");
    const btnCalibrateLine = document.getElementById("btn-calibrate-line");
    const btnFullRoi = document.getElementById("btn-full-roi");
    const canvasHint = document.getElementById("canvas-hint");

    const inputPxDist = document.getElementById("input-px-dist");
    const inputMmDist = document.getElementById("input-mm-dist");
    const btnSaveScale = document.getElementById("btn-save-scale");
    const valCurrentScale = document.getElementById("val-current-scale");

    // Estado Interativo do Canvas
    let canvasMode = "roi"; // "roi" ou "calibrate"
    let currentRoi = [20, 20, 600, 440];
    let isDrawing = false;
    let startX = 0, startY = 0;
    let calibratePts = null; // {x1, y1, x2, y2}

    // Atualização de Rótulos dos Sliders HSV
    function updateSliderLabels() {
        valHMin.textContent = hMinSlider.value;
        valHMax.textContent = hMaxSlider.value;
        valSMin.textContent = sMinSlider.value;
        valSMax.textContent = sMaxSlider.value;
        valVMin.textContent = vMinSlider.value;
        valVMax.textContent = vMaxSlider.value;
    }

    [hMinSlider, hMaxSlider, sMinSlider, sMaxSlider, vMinSlider, vMaxSlider].forEach(s => {
        s.addEventListener("input", updateSliderLabels);
    });

    // =========================================================================
    // DESENHO E INTERAÇÃO NO CANVAS
    // =========================================================================
    function drawCanvasOverlay() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Desenhar Retângulo de ROI
        if (currentRoi && currentRoi.length === 4) {
            const [x, y, w, h] = currentRoi;
            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
            ctx.fillRect(x, y, w, h);

            // Rótulo da ROI
            ctx.setLineDash([]);
            ctx.fillStyle = "#f59e0b";
            ctx.font = "12px Inter, sans-serif";
            ctx.fillText(`ROI (${w}x${h} px)`, x + 5, Math.max(15, y - 5));
        }

        // Desenhar Linha de Calibração se houver
        if (calibratePts) {
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(calibratePts.x1, calibratePts.y1);
            ctx.lineTo(calibratePts.x2, calibratePts.y2);
            ctx.stroke();

            // PONTOS A e B
            ctx.fillStyle = "#ef4444";
            ctx.beginPath();
            ctx.arc(calibratePts.x1, calibratePts.y1, 5, 0, 2 * Math.PI);
            ctx.arc(calibratePts.x2, calibratePts.y2, 5, 0, 2 * Math.PI);
            ctx.fill();

            // Rótulo de distância em Pixels
            const midX = (calibratePts.x1 + calibratePts.x2) / 2;
            const midY = (calibratePts.y1 + calibratePts.y2) / 2;
            const dx = calibratePts.x2 - calibratePts.x1;
            const dy = calibratePts.y2 - calibratePts.y1;
            const distPx = Math.sqrt(dx * dx + dy * dy).toFixed(1);

            ctx.fillStyle = "#3b82f6";
            ctx.font = "bold 13px Inter, sans-serif";
            ctx.fillText(`${distPx} px`, midX + 10, midY);

            inputPxDist.value = distPx;
        }
    }

    // Mudança de Ferramenta
    btnDrawRoi.addEventListener("click", () => {
        canvasMode = "roi";
        btnDrawRoi.classList.add("active");
        btnCalibrateLine.classList.remove("active");
        canvasHint.textContent = "Clique e arraste sobre o vídeo para desenhar a Região de Interesse (ROI).";
    });

    btnCalibrateLine.addEventListener("click", () => {
        canvasMode = "calibrate";
        btnCalibrateLine.classList.add("active");
        btnDrawRoi.classList.remove("active");
        canvasHint.textContent = "Clique e arraste sobre uma régua/peça no vídeo para medir a distância em pixels.";
    });

    btnFullRoi.addEventListener("click", () => {
        currentRoi = [0, 0, 640, 480];
        updateRoiInputFields();
        drawCanvasOverlay();
    });

    function updateRoiInputFields() {
        roiXInput.value = currentRoi[0];
        roiYInput.value = currentRoi[1];
        roiWInput.value = currentRoi[2];
        roiHInput.value = currentRoi[3];
    }

    [roiXInput, roiYInput, roiWInput, roiHInput].forEach(inp => {
        inp.addEventListener("change", () => {
            currentRoi = [
                parseInt(roiXInput.value) || 0,
                parseInt(roiYInput.value) || 0,
                parseInt(roiWInput.value) || 640,
                parseInt(roiHInput.value) || 480
            ];
            drawCanvasOverlay();
        });
    });

    // Eventos de Mouse no Canvas
    canvas.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawing = true;

        if (canvasMode === "calibrate") {
            calibratePts = { x1: startX, y1: startY, x2: startX, y2: startY };
        }
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

        if (canvasMode === "roi") {
            const x = Math.min(startX, currX);
            const y = Math.min(startY, currY);
            const w = Math.abs(currX - startX);
            const h = Math.abs(currY - startY);
            currentRoi = [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
            updateRoiInputFields();
        } else if (canvasMode === "calibrate") {
            calibratePts.x2 = currX;
            calibratePts.y2 = currY;
        }

        drawCanvasOverlay();
    });

    canvas.addEventListener("mouseup", () => {
        isDrawing = false;
    });

    // Presets Rápidos de Cores
    const presets = {
        red: { hsv_min: [0, 100, 100], hsv_max: [10, 255, 255], class_id: 1 },
        green: { hsv_min: [35, 100, 100], hsv_max: [85, 255, 255], class_id: 2 },
        blue: { hsv_min: [100, 100, 100], hsv_max: [130, 255, 255], class_id: 3 },
    };

    document.querySelectorAll(".btn-preset").forEach(btn => {
        btn.addEventListener("click", () => {
            const presetKey = btn.getAttribute("data-preset");
            if (presets[presetKey]) {
                const p = presets[presetKey];
                hMinSlider.value = p.hsv_min[0];
                sMinSlider.value = p.hsv_min[1];
                vMinSlider.value = p.hsv_min[2];

                hMaxSlider.value = p.hsv_max[0];
                sMaxSlider.value = p.hsv_max[1];
                vMaxSlider.value = p.hsv_max[2];

                recipeClassSelect.value = p.class_id;
                updateSliderLabels();
            }
        });
    });

    // =========================================================================
    // GERENCIAMENTO DE RECEITAS (CRUD)
    // =========================================================================
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
        recipeDescInput.value = recipe.description || "";
        recipeClassSelect.value = recipe.class_id || 1;

        hMinSlider.value = recipe.hsv_min ? recipe.hsv_min[0] : 0;
        sMinSlider.value = recipe.hsv_min ? recipe.hsv_min[1] : 100;
        vMinSlider.value = recipe.hsv_min ? recipe.hsv_min[2] : 100;

        hMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[0] : 10;
        sMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[1] : 255;
        vMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[2] : 255;

        recipeMinAreaInput.value = recipe.min_area || 200;
        recipeMaxAreaInput.value = recipe.max_area || 100000;
        minCountInput.value = recipe.min_count !== undefined ? recipe.min_count : 1;
        maxCountInput.value = recipe.max_count !== undefined ? recipe.max_count : 50;

        if (recipe.roi && recipe.roi.length === 4) {
            currentRoi = recipe.roi;
            updateRoiInputFields();
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

    btnNewRecipe.addEventListener("click", async () => {
        const res = await fetch("/api/recipes");
        const recipes = await res.json();
        const nextId = (Object.keys(recipes).length + 1).toString();

        const newRec = {
            id: nextId,
            name: `Nova Receita #${nextId}`,
            description: "Parâmetros de calibração",
            class_id: 1,
            hsv_min: [0, 100, 100],
            hsv_max: [10, 255, 255],
            min_area: 200,
            max_area: 100000,
            min_count: 1,
            max_count: 50,
            expected_shape: "any",
            roi: [20, 20, 600, 440]
        };

        populateRecipeForm(newRec);
        const opt = document.createElement("option");
        opt.value = nextId;
        opt.textContent = `#${nextId} - ${newRec.name}`;
        recipeSelect.appendChild(opt);
        recipeSelect.value = nextId;
    });

    btnSaveRecipe.addEventListener("click", async () => {
        const recipeId = recipeSelect.value || "1";
        const payload = {
            id: recipeId,
            name: recipeNameInput.value,
            description: recipeDescInput.value,
            class_id: parseInt(recipeClassSelect.value),
            hsv_min: [parseInt(hMinSlider.value), parseInt(sMinSlider.value), parseInt(vMinSlider.value)],
            hsv_max: [parseInt(hMaxSlider.value), parseInt(sMaxSlider.value), parseInt(vMaxSlider.value)],
            min_area: parseFloat(recipeMinAreaInput.value),
            max_area: parseFloat(recipeMaxAreaInput.value),
            min_count: parseInt(minCountInput.value),
            max_count: parseInt(maxCountInput.value),
            expected_shape: "any",
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

    btnDeleteRecipe.addEventListener("click", async () => {
        const recipeId = recipeSelect.value;
        if (!recipeId) return;
        if (confirm(`Tem certeza que deseja excluir a Receita #${recipeId}?`)) {
            const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
            if (res.ok) {
                alert("Receita excluída com sucesso!");
                loadRecipes();
            }
        }
    });

    btnApplyRecipe.addEventListener("click", async () => {
        const recipeId = recipeSelect.value;
        const res = await fetch(`/api/recipes/select/${recipeId}`, { method: "POST" });
        if (res.ok) {
            alert(`Receita #${recipeId} ativada no Raspberry Pi!`);
        }
    });

    btnTestTrigger.addEventListener("click", async () => {
        alert("Comando de disparo enviado para o motor de visão!");
    });

    // =========================================================================
    // CALIBRAÇÃO DIMENSIONAL (PIXEL -> MM)
    // =========================================================================
    btnSaveScale.addEventListener("click", async () => {
        const pxDist = parseFloat(inputPxDist.value);
        const mmDist = parseFloat(inputMmDist.value);

        if (pxDist > 0 && mmDist > 0) {
            const res = await fetch("/api/calibrate/distance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pixel_distance: pxDist, real_distance_mm: mmDist })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Calibração efetuada! Fator de Escala: ${data.px_per_mm} px/mm`);
                valCurrentScale.textContent = data.px_per_mm;
            }
        } else {
            alert("Informe valores válidos para pixels e milímetros.");
        }
    });

    // =========================================================================
    // CONFIGURAÇÃO DE REDE
    // =========================================================================
    async function loadNetworkConfig() {
        try {
            const res = await fetch("/api/network");
            const data = await res.json();
            document.getElementById("net-hostname").value = data.hostname;
            document.getElementById("net-pn-station").value = data.profinet_station_name;
            document.getElementById("net-ip").value = data.ip_address;
            document.getElementById("net-mask").value = data.subnet_mask;
            document.getElementById("net-gateway").value = data.gateway;
        } catch (err) {
            console.error("Erro ao carregar configurações de rede:", err);
        }
    }

    document.getElementById("btn-save-network").addEventListener("click", async () => {
        const payload = {
            ip_address: document.getElementById("net-ip").value,
            subnet_mask: document.getElementById("net-mask").value,
            gateway: document.getElementById("net-gateway").value,
        };

        const res = await fetch("/api/network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
        }
    });

    // =========================================================================
    // TELEMETRIA E BADGES (POLLING 100ms)
    // =========================================================================
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

            if (data.calibration && data.calibration.px_per_mm) {
                valCurrentScale.textContent = data.calibration.px_per_mm.toFixed(2);
            }

            // Badges
            const isReady = (inp.status_flags & (1 << 0)) !== 0;
            const isTarget = (inp.status_flags & (1 << 1)) !== 0;
            const isPass = (inp.status_flags & (1 << 2)) !== 0;

            const badgeReady = document.getElementById("badge-ready");
            const badgePass = document.getElementById("badge-pass");
            const badgeTarget = document.getElementById("badge-target");
            const badgeProfinet = document.getElementById("badge-profinet");

            if (isReady) badgeReady.classList.add("active"); else badgeReady.classList.remove("active");
            if (isPass) badgePass.classList.add("active"); else badgePass.classList.remove("active");
            if (isTarget) badgeTarget.classList.add("active"); else badgeTarget.classList.remove("active");
            badgeProfinet.classList.add("active");

        } catch (err) {
            console.error("Erro na telemetria:", err);
        }
    }

    // Inicialização
    loadRecipes();
    loadNetworkConfig();
    drawCanvasOverlay();
    setInterval(updateTelemetry, 200);
});
