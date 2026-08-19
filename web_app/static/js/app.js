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
            document.getElementById(targetTab)?.classList.add("active");
        });
    });

    // Função auxiliar para exibir Notificações Toast no topo da tela
    function showNotification(message, type = "success") {
        let toast = document.getElementById("system-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "system-toast";
            toast.style.position = "fixed";
            toast.style.top = "20px";
            toast.style.right = "20px";
            toast.style.zIndex = "9999";
            toast.style.padding = "12px 20px";
            toast.style.borderRadius = "8px";
            toast.style.fontWeight = "600";
            toast.style.fontSize = "14px";
            toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            toast.style.transition = "all 0.3s ease";
            document.body.appendChild(toast);
        }

        if (type === "error") {
            toast.style.backgroundColor = "#ef4444";
            toast.style.color = "#ffffff";
        } else if (type === "warning") {
            toast.style.backgroundColor = "#f59e0b";
            toast.style.color = "#000000";
        } else {
            toast.style.backgroundColor = "#10b981";
            toast.style.color = "#ffffff";
        }

        toast.textContent = message;
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-10px)";
        }, 3500);
    }

    // =========================================================================
    // ELEMENTOS DA DOM DA ABA 1 (VISÃO E CALIBRAÇÃO)
    // =========================================================================
    const canvas = document.getElementById("roi-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

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
        if (valHMin && hMinSlider) valHMin.textContent = hMinSlider.value;
        if (valHMax && hMaxSlider) valHMax.textContent = hMaxSlider.value;
        if (valSMin && sMinSlider) valSMin.textContent = sMinSlider.value;
        if (valSMax && sMaxSlider) valSMax.textContent = sMaxSlider.value;
        if (valVMin && vMinSlider) valVMin.textContent = vMinSlider.value;
        if (valVMax && vMaxSlider) valVMax.textContent = vMaxSlider.value;
    }

    [hMinSlider, hMaxSlider, sMinSlider, sMaxSlider, vMinSlider, vMaxSlider].forEach(s => {
        s?.addEventListener("input", updateSliderLabels);
    });

    // =========================================================================
    // DESENHO E INTERAÇÃO NO CANVAS
    // =========================================================================
    function drawCanvasOverlay() {
        if (!ctx || !canvas) return;
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

            if (inputPxDist) inputPxDist.value = distPx;
        }
    }

    // Mudança de Ferramenta
    btnDrawRoi?.addEventListener("click", () => {
        canvasMode = "roi";
        btnDrawRoi.classList.add("active");
        btnCalibrateLine?.classList.remove("active");
        if (canvasHint) canvasHint.textContent = "Clique e arraste sobre o vídeo para desenhar a Região de Interesse (ROI).";
    });

    btnCalibrateLine?.addEventListener("click", () => {
        canvasMode = "calibrate";
        btnCalibrateLine.classList.add("active");
        btnDrawRoi?.classList.remove("active");
        if (canvasHint) canvasHint.textContent = "Clique e arraste sobre uma régua/peça no vídeo para medir a distância em pixels.";
    });

    btnFullRoi?.addEventListener("click", () => {
        currentRoi = [0, 0, 640, 480];
        updateRoiInputFields();
        drawCanvasOverlay();
        showNotification("ROI redefinida para tela cheia (640x480).");
    });

    function updateRoiInputFields() {
        if (roiXInput) roiXInput.value = currentRoi[0];
        if (roiYInput) roiYInput.value = currentRoi[1];
        if (roiWInput) roiWInput.value = currentRoi[2];
        if (roiHInput) roiHInput.value = currentRoi[3];
    }

    [roiXInput, roiYInput, roiWInput, roiHInput].forEach(inp => {
        inp?.addEventListener("change", () => {
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
    canvas?.addEventListener("mousedown", (e) => {
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawing = true;

        if (canvasMode === "calibrate") {
            calibratePts = { x1: startX, y1: startY, x2: startX, y2: startY };
        }
    });

    canvas?.addEventListener("mousemove", (e) => {
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
            if (calibratePts) {
                calibratePts.x2 = currX;
                calibratePts.y2 = currY;
            }
        }

        drawCanvasOverlay();
    });

    canvas?.addEventListener("mouseup", () => {
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
                if (hMinSlider) hMinSlider.value = p.hsv_min[0];
                if (sMinSlider) sMinSlider.value = p.hsv_min[1];
                if (vMinSlider) vMinSlider.value = p.hsv_min[2];

                if (hMaxSlider) hMaxSlider.value = p.hsv_max[0];
                if (sMaxSlider) sMaxSlider.value = p.hsv_max[1];
                if (vMaxSlider) vMaxSlider.value = p.hsv_max[2];

                if (recipeClassSelect) recipeClassSelect.value = p.class_id;
                updateSliderLabels();
                showNotification(`Preset de cor aplicado: ${presetKey.toUpperCase()}`);
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
            if (recipeSelect) {
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
            }
        } catch (err) {
            console.error("Erro ao carregar receitas:", err);
        }
    }

    function populateRecipeForm(recipe) {
        if (recipeNameInput) recipeNameInput.value = recipe.name || "";
        if (recipeDescInput) recipeDescInput.value = recipe.description || "";
        if (recipeClassSelect) recipeClassSelect.value = recipe.class_id || 1;

        if (hMinSlider) hMinSlider.value = recipe.hsv_min ? recipe.hsv_min[0] : 0;
        if (sMinSlider) sMinSlider.value = recipe.hsv_min ? recipe.hsv_min[1] : 100;
        if (vMinSlider) vMinSlider.value = recipe.hsv_min ? recipe.hsv_min[2] : 100;

        if (hMaxSlider) hMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[0] : 10;
        if (sMaxSlider) sMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[1] : 255;
        if (vMaxSlider) vMaxSlider.value = recipe.hsv_max ? recipe.hsv_max[2] : 255;

        if (recipeMinAreaInput) recipeMinAreaInput.value = recipe.min_area || 200;
        if (recipeMaxAreaInput) recipeMaxAreaInput.value = recipe.max_area || 100000;
        if (minCountInput) minCountInput.value = recipe.min_count !== undefined ? recipe.min_count : 1;
        if (maxCountInput) maxCountInput.value = recipe.max_count !== undefined ? recipe.max_count : 50;

        if (recipe.roi && recipe.roi.length === 4) {
            currentRoi = recipe.roi;
            updateRoiInputFields();
            drawCanvasOverlay();
        }
        updateSliderLabels();
    }

    recipeSelect?.addEventListener("change", async (e) => {
        const id = e.target.value;
        const res = await fetch("/api/recipes");
        const recipes = await res.json();
        if (recipes[id]) {
            populateRecipeForm(recipes[id]);
        }
    });

    btnNewRecipe?.addEventListener("click", async () => {
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
        if (recipeSelect) {
            const opt = document.createElement("option");
            opt.value = nextId;
            opt.textContent = `#${nextId} - ${newRec.name}`;
            recipeSelect.appendChild(opt);
            recipeSelect.value = nextId;
        }
        showNotification(`Nova Receita #${nextId} criada. Preencha e clique em Salvar.`);
    });

    btnSaveRecipe?.addEventListener("click", async () => {
        const recipeId = recipeSelect?.value || "1";
        const payload = {
            id: recipeId,
            name: recipeNameInput?.value || "Nova Receita",
            description: recipeDescInput?.value || "",
            class_id: parseInt(recipeClassSelect?.value || "1"),
            hsv_min: [parseInt(hMinSlider?.value || "0"), parseInt(sMinSlider?.value || "100"), parseInt(vMinSlider?.value || "100")],
            hsv_max: [parseInt(hMaxSlider?.value || "180"), parseInt(sMaxSlider?.value || "255"), parseInt(vMaxSlider?.value || "255")],
            min_area: parseFloat(recipeMinAreaInput?.value || "200"),
            max_area: parseFloat(recipeMaxAreaInput?.value || "100000"),
            min_count: parseInt(minCountInput?.value || "1"),
            max_count: parseInt(maxCountInput?.value || "50"),
            expected_shape: "any",
            roi: currentRoi,
        };

        try {
            const res = await fetch("/api/recipes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showNotification(`✅ Receita #${recipeId} salva com sucesso!`);
                loadRecipes();
            }
        } catch (err) {
            showNotification(`❌ Erro ao salvar receita: ${err}`, "error");
        }
    });

    btnDeleteRecipe?.addEventListener("click", async () => {
        const recipeId = recipeSelect?.value;
        if (!recipeId) return;
        if (confirm(`Tem certeza que deseja excluir a Receita #${recipeId}?`)) {
            const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
            if (res.ok) {
                showNotification(`🗑️ Receita #${recipeId} excluída!`, "warning");
                loadRecipes();
            }
        }
    });

    btnApplyRecipe?.addEventListener("click", async () => {
        const recipeId = recipeSelect?.value;
        if (!recipeId) return;
        const res = await fetch(`/api/recipes/select/${recipeId}`, { method: "POST" });
        if (res.ok) {
            showNotification(`▶️ Receita #${recipeId} ativada no Raspberry Pi!`);
        }
    });

    btnTestTrigger?.addEventListener("click", async () => {
        showNotification("📷 Comando de disparo (Trigger) enviado!");
    });

    // =========================================================================
    // CALIBRAÇÃO DIMENSIONAL (PIXEL -> MM)
    // =========================================================================
    btnSaveScale?.addEventListener("click", async () => {
        const pxDist = parseFloat(inputPxDist?.value || "0");
        const mmDist = parseFloat(inputMmDist?.value || "0");

        if (pxDist > 0 && mmDist > 0) {
            try {
                const res = await fetch("/api/calibrate/distance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pixel_distance: pxDist, real_distance_mm: mmDist })
                });

                if (res.ok) {
                    const data = await res.json();
                    showNotification(`📐 Calibração Aplicada! Escala: ${data.px_per_mm} px/mm`);
                    if (valCurrentScale) valCurrentScale.textContent = data.px_per_mm;
                }
            } catch (err) {
                showNotification(`❌ Erro na calibração: ${err}`, "error");
            }
        } else {
            showNotification("Informe valores válidos para pixels e milímetros.", "warning");
        }
    });

    // =========================================================================
    // CONFIGURAÇÃO DE REDE
    // =========================================================================
    async function loadNetworkConfig() {
        try {
            const res = await fetch("/api/network");
            const data = await res.json();
            const netHostname = document.getElementById("net-hostname");
            const netPnStation = document.getElementById("net-pn-station");
            const netIp = document.getElementById("net-ip");
            const netMask = document.getElementById("net-mask");
            const netGateway = document.getElementById("net-gateway");

            if (netHostname) netHostname.value = data.hostname;
            if (netPnStation) netPnStation.value = data.profinet_station_name;
            if (netIp) netIp.value = data.ip_address;
            if (netMask) netMask.value = data.subnet_mask;
            if (netGateway) netGateway.value = data.gateway;
        } catch (err) {
            console.error("Erro ao carregar configurações de rede:", err);
        }
    }

    document.getElementById("btn-save-network")?.addEventListener("click", async () => {
        const netIp = document.getElementById("net-ip")?.value || "192.168.0.231";
        const netMask = document.getElementById("net-mask")?.value || "255.255.255.0";
        const netGateway = document.getElementById("net-gateway")?.value || "192.168.0.1";

        const payload = {
            ip_address: netIp,
            subnet_mask: netMask,
            gateway: netGateway,
        };

        try {
            const res = await fetch("/api/network", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                showNotification(`🌐 IP de Rede Atualizado: ${netIp}`);
            }
        } catch (err) {
            showNotification(`❌ Erro ao configurar rede: ${err}`, "error");
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

            const elemFlags = document.getElementById("val-status-flags");
            const elemClass = document.getElementById("val-class-id");
            const elemCount = document.getElementById("val-object-count");
            const elemPosX = document.getElementById("val-pos-x");
            const elemPosY = document.getElementById("val-pos-y");
            const elemAngle = document.getElementById("val-angle");
            const elemTrig = document.getElementById("val-trigger-cmd");
            const elemRec = document.getElementById("val-active-recipe");
            const elemHB = document.getElementById("val-heartbeat");

            if (elemFlags) elemFlags.textContent = "0x" + inp.status_flags.toString(16).padStart(4, '0').toUpperCase();
            if (elemClass) elemClass.textContent = inp.class_id;
            if (elemCount) elemCount.textContent = inp.object_count;
            if (elemPosX) elemPosX.textContent = inp.pos_x_mm.toFixed(2);
            if (elemPosY) elemPosY.textContent = inp.pos_y_mm.toFixed(2);
            if (elemAngle) elemAngle.textContent = inp.angle_deg.toFixed(2) + "°";
            if (elemTrig) elemTrig.textContent = out.trigger_cmd;
            if (elemRec) elemRec.textContent = inp.active_recipe;
            if (elemHB) elemHB.textContent = data.heartbeat;

            if (data.calibration && data.calibration.px_per_mm && valCurrentScale) {
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

            if (badgeReady) { if (isReady) badgeReady.classList.add("active"); else badgeReady.classList.remove("active"); }
            if (badgePass) { if (isPass) badgePass.classList.add("active"); else badgePass.classList.remove("active"); }
            if (badgeTarget) { if (isTarget) badgeTarget.classList.add("active"); else badgeTarget.classList.remove("active"); }
            if (badgeProfinet) badgeProfinet.classList.add("active");

        } catch (err) {
            console.error("Erro na telemetria:", err);
        }
    }

    // =========================================================================
    // ATUALIZAÇÃO AUTOMÁTICA VIA GITHUB
    // =========================================================================
    const btnGithubUpdate = document.getElementById("btn-github-update");
    if (btnGithubUpdate) {
        btnGithubUpdate.addEventListener("click", async () => {
            if (confirm("Deseja buscar e instalar as últimas atualizações do repositório GitHub no Raspberry Pi?")) {
                btnGithubUpdate.textContent = "⏳ Atualizando...";
                btnGithubUpdate.disabled = true;

                try {
                    const res = await fetch("/api/system/update", { method: "POST" });
                    const data = await res.json();
                    if (res.ok) {
                        showNotification(`✅ Atualização Concluída!\n\n${data.message}`);
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showNotification(`❌ Erro ao atualizar: ${data.detail || data.message}`, "error");
                    }
                } catch (err) {
                    showNotification(`❌ Falha na conexão de atualização: ${err}`, "error");
                } finally {
                    btnGithubUpdate.textContent = "🔄 Atualizar pelo GitHub";
                    btnGithubUpdate.disabled = false;
                }
            }
        });
    }

    // Inicialização
    loadRecipes();
    loadNetworkConfig();
    drawCanvasOverlay();
    setInterval(updateTelemetry, 200);
});
