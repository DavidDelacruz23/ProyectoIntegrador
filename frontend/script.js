// --- VARIABLES GLOBALES ---
let categories = [];
let inventory = [];
let sales = [];
let deletedRecords = [];
let incomingRecords = [];
let cart = [];
let chartInstances = {};
var currentUserRole = null;

const API_BASE_URL = window.location.pathname.includes("/frontend/")
  ? "../backend/backend.php"
  : "backend.php";

let editingCategoryId = null;
let editingProductId = null;

// --- INICIALIZACIÓN Y PERSISTENCIA CON BACKEND (PHP + MYSQL) ---
async function initApp() {
  try {
    // Obtenemos de manera centralizada todo el estado inicial desde MySQL
    const response = await fetch(`${API_BASE_URL}?action=getAll`);
    const data = await response.json();

    categories = data.categories || [];
    inventory = cleanData(data.inventory || []);
    sales = data.sales || [];
    deletedRecords = data.deletedRecords || [];
    incomingRecords = data.incomingRecords || [];

    console.log("Datos cargados exitosamente desde MySQL");
  } catch (error) {
    console.error(
      "Error al conectar con backend.php. Usando datos vacíos de respaldo.",
      error,
    );
    categories = [];
    inventory = [];
    sales = [];
    deletedRecords = [];
    incomingRecords = [];
  }

  updateCategoryDropdowns();
  showView("login-view");
}

// Función auxiliar para despachar los cambios al servidor en formato JSON
async function syncWithBackend(action, payload = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.status) {
      console.error(`Error en el servidor al ejecutar la acción: ${action}`);
    }
    return result;
  } catch (error) {
    console.error(`Error de red al intentar sincronizar: ${action}`, error);
  }
}

// --- UTILIDADES ---
const cleanData = (data) => {
  return data.map((item) => ({
    id: item.id.toString().trim(),
    name: (item.name || item.nombre || "").trim(),
    category: capitalize((item.category || item.categoria || "").trim().toLowerCase()),
    stock: isNaN(item.stock) ? 0 : parseInt(item.stock),
    price: parseFloat(item.price || item.precio || 0),
    brand: capitalize((item.brand || item.marca || "").trim().toLowerCase()),
  }));
};
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
const formatMoney = (amount) => `$${parseFloat(amount).toFixed(2)}`;
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
};
const getTodayStr = () => new Date().toISOString().split("T")[0];

// --- NAVEGACIÓN Y VISTAS ---
function showView(targetId) {
  const publicViews = ["login-view", "recover-view"];
  const allowedViewsByRole = {
    admin: [
      "dashboard-view",
      "categories-view",
      "inventory-view",
      "sales-view",
      "reports-view",
    ],
    cajero: ["sales-view", "reports-view"],
  };

  if (!publicViews.includes(targetId) && !currentUserRole) {
    targetId = "login-view";
  }

  if (
    currentUserRole &&
    !publicViews.includes(targetId) &&
    !allowedViewsByRole[currentUserRole].includes(targetId)
  ) {
    targetId = currentUserRole === "cajero" ? "sales-view" : "dashboard-view";
  }

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(targetId).classList.add("active");

  const mainSidebar = document.getElementById("main-sidebar");
  const mainHeader = document.getElementById("main-header");

  if (targetId === "login-view" || targetId === "recover-view") {
    mainSidebar.classList.add("hidden");
    mainHeader.classList.add("hidden");
  } else {
    mainSidebar.classList.remove("hidden");
    mainHeader.classList.remove("hidden");
  }

  if (targetId === "dashboard-view") renderDashboard();
  if (targetId === "categories-view") renderCategories();
  if (targetId === "inventory-view") renderInventory();
  if (targetId === "sales-view") renderPOS();
  if (targetId === "reports-view") renderReports();

  updateActiveNav(targetId);
}

function updateActiveNav(targetId) {
  document.querySelectorAll(".sidebar .nav-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-target") === targetId,
    );
  });
}

function applyRolePermissions() {
  const userName = document.querySelector(".user-profile .user-name");
  if (userName) {
    userName.innerText =
      currentUserRole === "admin" ? "Administrador" : "Cajero";
  }

  document.querySelectorAll(".sidebar .nav-btn").forEach((btn) => {
    const target = btn.getAttribute("data-target");
    const isAllowedForCashier = ["sales-view", "reports-view"].includes(
      target,
    );
    btn.classList.toggle(
      "hidden",
      currentUserRole === "cajero" && !isAllowedForCashier,
    );
  });
}

document.querySelectorAll(".sidebar .nav-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    showView(e.currentTarget.getAttribute("data-target"));
  });
});

async function handleLogin() {
  const usuario = document.getElementById("login-usuario").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error");

  errorBox.classList.add("hidden");
  errorBox.innerText = "";

  if (!usuario || !password) {
    errorBox.innerText = "Ingrese usuario y contrase\u00f1a.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });
    const result = await response.json();

    if (result.status) {
      currentUserRole = result.rol;
      applyRolePermissions();
      showView(currentUserRole === "cajero" ? "sales-view" : "dashboard-view");
    } else {
      errorBox.innerText = "Usuario o contrase\u00f1a incorrectos.";
      errorBox.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error al iniciar sesi\u00f3n:", error);
    errorBox.innerText = "No se pudo conectar con el servidor.";
    errorBox.classList.remove("hidden");
  }
}

document.getElementById("btn-login").addEventListener("click", handleLogin);
["login-usuario", "login-password"].forEach((id) => {
  document.getElementById(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });
});

// --- GESTIÓN DE MODALES ---
function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

// --- CRUD CATEGORÍAS ---
function updateCategoryDropdowns() {
  const selects = document.querySelectorAll(".dynamic-category-select");
  selects.forEach((select) => {
    const isFilter = select.id.includes("filter");
    select.innerHTML = isFilter
      ? '<option value="all">Todas las Categorías</option>'
      : "";
    categories.forEach((cat) => {
      select.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
  });
}

function renderCategories() {
  const tbody = document.getElementById("categories-tbody");
  tbody.innerHTML = "";
  categories.forEach((cat) => {
    tbody.innerHTML += `
      <tr>
        <td>${cat.id}</td>
        <td><strong>${cat.name}</strong></td>
        <td>
          <button style="color:var(--primary); background:none; border:none; cursor:pointer; margin-right:10px;" onclick="openCategoryModal('${cat.id}')"><i class="fas fa-edit fa-lg"></i></button>
          <button style="color:var(--danger); background:none; border:none; cursor:pointer;" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash fa-lg"></i></button>
        </td>
      </tr>`;
  });
}

window.openCategoryModal = function (id = null) {
  editingCategoryId = id;
  document.getElementById("cat-modal-title").innerText = id
    ? "Editar Categoría"
    : "Nueva Categoría";

  if (id) {
    const cat = categories.find((c) => c.id === id);
    document.getElementById("form-cat-id").value = cat.id;
    document.getElementById("form-cat-name").value = cat.name;
  } else {
    document.getElementById("form-cat-id").value =
      "C" + Date.now().toString().slice(-4);
    document.getElementById("form-cat-name").value = "";
  }
  openModal("category-modal");
};

window.saveCategory = async function () {
  const id = document.getElementById("form-cat-id").value;
  const name = document.getElementById("form-cat-name").value.trim();
  if (!name) return alert("El nombre es obligatorio");

  if (editingCategoryId) {
    const catIndex = categories.findIndex((c) => c.id === editingCategoryId);
    const oldName = categories[catIndex].name;
    categories[catIndex].name = name;

    // Actualización en cascada local
    inventory.forEach((p) => {
      if (p.category === oldName) p.category = name;
    });

    // Sincronizamos la edición y el impacto en cascada hacia la BD
    await syncWithBackend("saveCategory", { id, name, oldName });
  } else {
    const newCat = { id, name };
    categories.push(newCat);
    await syncWithBackend("saveCategory", newCat);
  }

  updateCategoryDropdowns();
  renderCategories();
  closeModal("category-modal");
};

window.deleteCategory = async function (id) {
  const cat = categories.find((c) => c.id === id);
  const isInUse = inventory.some((p) => p.category === cat.name);
  if (isInUse)
    return alert(
      "No puedes eliminar esta categoría porque hay productos asignados a ella.",
    );

  if (confirm(`¿Seguro que deseas eliminar la categoría ${cat.name}?`)) {
    categories = categories.filter((c) => c.id !== id);
    await syncWithBackend("deleteCategory", { id });
    updateCategoryDropdowns();
    renderCategories();
  }
};

// --- CRUD INVENTARIO ---
function renderInventory() {
  const tbody = document.getElementById("inventory-tbody");
  const searchInput = document.getElementById("inv-search");
  const catFilter = document.getElementById("inv-filter-category");

  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const filterCat = catFilter ? catFilter.value : "all";

  tbody.innerHTML = "";
  inventory.forEach((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search) ||
      item.id.toLowerCase().includes(search);
    const matchCat = filterCat === "all" || item.category === filterCat;

    if (matchSearch && matchCat) {
      const stockClass = item.stock < 5 ? "stock-low" : "stock-high";
      tbody.innerHTML += `
        <tr>
          <td>${item.id}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.category}</td>
          <td>${item.brand}</td>
          <td>${formatMoney(item.price)}</td>
          <td><span class="stock-badge ${stockClass}">${item.stock}</span></td>
          <td class="actions-cell">
             <button style="color:var(--success); border:none; background:none; cursor:pointer; margin-right:10px;" onclick="addStockItem('${item.id}')" title="Ingresar Stock"><i class="fas fa-plus-circle fa-lg"></i></button>
             <button style="color:var(--primary); border:none; background:none; cursor:pointer; margin-right:10px;" onclick="openProductModal('${item.id}')" title="Editar"><i class="fas fa-edit fa-lg"></i></button>
             <button style="color:var(--danger); border:none; background:none; cursor:pointer;" onclick="deleteInventoryItem('${item.id}')" title="Eliminar"><i class="fas fa-trash fa-lg"></i></button>
          </td>
        </tr>`;
    }
  });
}

if (document.getElementById("inv-search")) {
  document
    .getElementById("inv-search")
    .addEventListener("input", renderInventory);
  document
    .getElementById("inv-filter-category")
    .addEventListener("change", renderInventory);
}

window.openProductModal = function (id = null) {
  editingProductId = id;
  document.getElementById("prod-modal-title").innerText = id
    ? "Editar Producto"
    : "Nuevo Producto";
  updateCategoryDropdowns();

  if (id) {
    const prod = inventory.find((p) => p.id === id);
    document.getElementById("form-prod-original-id").value = prod.id;
    document.getElementById("form-prod-id").value = prod.id;
    document.getElementById("form-prod-name").value = prod.name;
    document.getElementById("form-prod-category").value = prod.category;
    document.getElementById("form-prod-brand").value = prod.brand;
    document.getElementById("form-prod-price").value = prod.price;
    document.getElementById("form-prod-stock").value = prod.stock;
  } else {
    document.getElementById("form-prod-original-id").value = "";
    document.getElementById("form-prod-id").value =
      "P" + Date.now().toString().slice(-4);
    document.getElementById("form-prod-name").value = "";
    document.getElementById("form-prod-brand").value = "";
    document.getElementById("form-prod-price").value = "";
    document.getElementById("form-prod-stock").value = "0";
  }
  openModal("product-modal");
};

window.saveProduct = async function () {
  const originalId = document.getElementById("form-prod-original-id").value;
  const id = document.getElementById("form-prod-id").value.trim();
  const name = document.getElementById("form-prod-name").value.trim();
  const category = document.getElementById("form-prod-category").value;
  const brand = document.getElementById("form-prod-brand").value.trim();
  const price = parseFloat(document.getElementById("form-prod-price").value);
  const stock = parseInt(document.getElementById("form-prod-stock").value);

  if (!id || !name || isNaN(price) || isNaN(stock)) {
    return alert(
      "Complete los campos obligatorios numéricos/texto correctamente.",
    );
  }

  const newProduct = { id, name, category, brand, price, stock };

  if (editingProductId) {
    const index = inventory.findIndex((p) => p.id === originalId);
    inventory[index] = newProduct;
    await syncWithBackend("saveProduct", { ...newProduct, originalId });
  } else {
    if (inventory.some((p) => p.id === id))
      return alert("El ID del producto ya existe.");
    inventory.push(newProduct);
    await syncWithBackend("saveProduct", newProduct);
  }

  renderInventory();
  closeModal("product-modal");
};

window.addStockItem = async function (id) {
  const qty = parseInt(prompt("¿Cuántas unidades deseas ingresar?"));
  if (isNaN(qty) || qty <= 0) return;

  const prodIndex = inventory.findIndex((p) => p.id === id);
  if (prodIndex > -1) {
    inventory[prodIndex].stock += qty;

    const incomingLog = {
      date: new Date().toISOString(),
      id: inventory[prodIndex].id,
      name: inventory[prodIndex].name,
      qty: qty,
    };
    incomingRecords.push(incomingLog);

    // Sincronizamos la actualización de stock e insertamos el log en la BD
    await syncWithBackend("addStock", {
      id,
      stock: inventory[prodIndex].stock,
      log: incomingLog,
    });

    renderInventory();
    alert("Stock ingresado correctamente.");
  }
};

window.deleteInventoryItem = async function (id) {
  const reason = prompt(
    "Indique el motivo de la eliminación (Ej: Dañado, Fuera de catálogo):",
  );
  if (!reason) return;

  const prodIndex = inventory.findIndex((p) => p.id === id);
  if (prodIndex > -1) {
    const prod = inventory[prodIndex];
    const deleteLog = {
      date: new Date().toISOString(),
      id: prod.id,
      name: prod.name,
      reason: reason,
    };
    deletedRecords.push(deleteLog);
    inventory.splice(prodIndex, 1);

    // Mandamos la orden de remover y registrar la auditoría
    await syncWithBackend("deleteProduct", { id, log: deleteLog });

    renderInventory();
    alert("Producto eliminado del inventario.");
  }
};

// --- RENDER DASHBOARD ---
function renderDashboard() {
  const totalSalesAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalStock = inventory.reduce((sum, prod) => sum + prod.stock, 0);
  const todayStr = getTodayStr();
  const todaySalesAmount = sales
    .filter((s) => s.date.startsWith(todayStr))
    .reduce((sum, sale) => sum + sale.total, 0);

  let productSalesMap = {};
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      productSalesMap[item.name] = (productSalesMap[item.name] || 0) + item.qty;
    });
  });
  let topProduct = "-",
    maxQty = 0;
  for (const [name, qty] of Object.entries(productSalesMap)) {
    if (qty > maxQty) {
      maxQty = qty;
      topProduct = name;
    }
  }

  document.getElementById("kpi-total-sales").innerText =
    formatMoney(totalSalesAmount);
  document.getElementById("kpi-total-stock").innerText = totalStock;
  document.getElementById("kpi-top-product").innerText = topProduct;
  document.getElementById("kpi-daily-revenue").innerText =
    formatMoney(todaySalesAmount);

  const insights = document.getElementById("insights-container");
  insights.innerHTML = "";
  const lowStock = inventory.filter((p) => p.stock < 5);
  if (lowStock.length > 0)
    insights.innerHTML += `<div class="insight-item warning"><i class="fas fa-exclamation-triangle"></i> <strong>Alerta:</strong> ${lowStock.length} producto(s) con bajo stock.</div>`;
  if (todaySalesAmount > 0)
    insights.innerHTML += `<div class="insight-item info"><i class="fas fa-chart-line"></i> <strong>Tendencia:</strong> Tienes ventas registradas el día de hoy.</div>`;

  renderCharts();
}

function renderCharts() {
  ["categoryChart", "evolutionChart", "brandChart"].forEach((id) => {
    if (chartInstances[id]) chartInstances[id].destroy();
  });

  const catSalesMap = {};
  sales.forEach((s) => {
    s.items.forEach((item) => {
      catSalesMap[item.category] = (catSalesMap[item.category] || 0) + item.qty;
    });
  });
  const catLabels =
    Object.keys(catSalesMap).length > 0
      ? Object.keys(catSalesMap)
      : ["Sin Ventas"];
  const catData =
    Object.keys(catSalesMap).length > 0 ? Object.values(catSalesMap) : [1];

  chartInstances["categoryChart"] = new Chart(
    document.getElementById("categoryChart").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [
          {
            data: catData,
            backgroundColor:
              Object.keys(catSalesMap).length > 0
                ? ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
                : ["#e2e8f0"],
          },
        ],
      },
      options: { maintainAspectRatio: false },
    },
  );

  const evoData = sales.map((s) => s.total);
  chartInstances["evolutionChart"] = new Chart(
    document.getElementById("evolutionChart").getContext("2d"),
    {
      type: "line",
      data: {
        labels: sales.map((_, i) => `V. ${i + 1}`),
        datasets: [
          {
            label: "Ingresos",
            data: evoData.length ? evoData : [0],
            borderColor: "#2563eb",
            fill: true,
            backgroundColor: "rgba(37,99,235,0.1)",
          },
        ],
      },
      options: { maintainAspectRatio: false },
    },
  );

  const brandMap = {};
  inventory.forEach((p) => {
    brandMap[p.brand] = (brandMap[p.brand] || 0) + p.stock;
  });
  chartInstances["brandChart"] = new Chart(
    document.getElementById("brandChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: Object.keys(brandMap).length
          ? Object.keys(brandMap)
          : ["Sin datos"],
        datasets: [
          {
            label: "Unidades en Stock",
            data: Object.keys(brandMap).length ? Object.values(brandMap) : [0],
            backgroundColor: "#475569",
          },
        ],
      },
      options: { maintainAspectRatio: false },
    },
  );
}

// --- POS (VENTAS) ---
function renderPOS() {
  const grid = document.getElementById("pos-product-grid");
  const searchInput = document.getElementById("pos-search");
  const catFilter = document.getElementById("pos-filter-category");

  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const filterCat = catFilter ? catFilter.value : "all";

  grid.innerHTML = "";
  inventory.forEach((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search) ||
      item.id.toLowerCase().includes(search);
    const matchCat = filterCat === "all" || item.category === filterCat;

    if (matchSearch && matchCat) {
      const outOfStock = item.stock === 0;
      grid.innerHTML += `
        <div class="product-card ${outOfStock ? "disabled" : ""}" onclick="addToCart('${item.id}')">
          <h4>${item.name}</h4><p class="price">${formatMoney(item.price)}</p><p class="stock">Stock: ${item.stock}</p>
        </div>`;
    }
  });
  renderCart();
}

if (document.getElementById("pos-search")) {
  document.getElementById("pos-search").addEventListener("input", renderPOS);
  document
    .getElementById("pos-filter-category")
    .addEventListener("change", renderPOS);
}

window.addToCart = function (id) {
  const product = inventory.find((p) => p.id === id);
  if (!product || product.stock === 0) return;
  const existing = cart.find((c) => c.id === id);
  if (existing) {
    if (existing.qty < product.stock) existing.qty++;
    else alert("No hay suficiente stock para añadir más.");
  } else cart.push({ ...product, qty: 1 });
  renderCart();
};

window.modifyQty = function (id, delta) {
  const itemIndex = cart.findIndex((c) => c.id === id);
  if (itemIndex > -1) {
    const product = inventory.find((p) => p.id === id);
    cart[itemIndex].qty += delta;
    if (cart[itemIndex].qty <= 0) cart.splice(itemIndex, 1);
    else if (cart[itemIndex].qty > product.stock)
      cart[itemIndex].qty = product.stock;
  }
  renderCart();
};

function renderCart() {
  const cartContainer = document.getElementById("cart-items");
  cartContainer.innerHTML = "";
  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.qty;
    cartContainer.innerHTML += `
      <div class="cart-item">
        <div class="cart-item-info"><h4>${item.name}</h4><p>${formatMoney(item.price)} x ${item.qty}</p></div>
        <div class="cart-controls">
          <button class="qty-btn" onclick="modifyQty('${item.id}', -1)">-</button><span>${item.qty}</span><button class="qty-btn" onclick="modifyQty('${item.id}', 1)">+</button>
        </div>
      </div>`;
  });
  document.getElementById("cart-subtotal").innerText = formatMoney(total);
  document.getElementById("cart-total").innerText = formatMoney(total);
  document.getElementById("btn-confirm-sale").disabled = cart.length === 0;
}

document
  .getElementById("btn-confirm-sale")
  .addEventListener("click", async () => {
    if (cart.length === 0) return;
    const saleTotal = cart.reduce(
      (sum, item) => sum + item.price * item.qty,
      0,
    );
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    const newSale = {
      id: "V" + Date.now(),
      date: new Date().toISOString(),
      items: cart.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        qty: i.qty,
        price: i.price,
      })),
      totalItems: totalItems,
      total: saleTotal,
    };

    sales.push(newSale);

    cart.forEach((cartItem) => {
      const product = inventory.find((p) => p.id === cartItem.id);
      if (product) product.stock -= cartItem.qty;
    });

    // Enviamos la venta completa y el estado actualizado del stock remanente
    await syncWithBackend("confirmSale", {
      sale: newSale,
      inventoryUpdates: inventory,
    });

    cart = [];
    alert("¡Venta registrada con éxito!");
    renderPOS();
  });

// --- MÓDULO DE REPORTES ---
function renderReports() {
  const dateInput = document.getElementById("rep-date-input");
  const repDateTbody = document.getElementById("rep-date-tbody");
  if (!dateInput.value) dateInput.value = getTodayStr();

  const renderDateSales = (selectedDate) => {
    if (!selectedDate) return;
    const filteredSales = sales.filter((s) => s.date.startsWith(selectedDate));
    repDateTbody.innerHTML = "";
    if (filteredSales.length === 0) {
      repDateTbody.innerHTML = `<tr><td colspan='4'>No hay ventas para la fecha seleccionada.</td></tr>`;
    } else {
      filteredSales.forEach((sale) => {
        repDateTbody.innerHTML += `<tr><td>${formatDate(sale.date)}</td><td><strong>${sale.id}</strong></td><td>${sale.totalItems} unid.</td><td style="color:var(--success); font-weight:bold;">${formatMoney(sale.total)}</td></tr>`;
      });
    }
  };

  if (!dateInput.hasAttribute("data-listener")) {
    dateInput.addEventListener("change", (e) =>
      renderDateSales(e.target.value),
    );
    dateInput.setAttribute("data-listener", "true");
  }
  renderDateSales(dateInput.value);

  const totalSalesVol = sales.reduce((sum, sale) => sum + sale.total, 0);
  const avgTicket = sales.length ? totalSalesVol / sales.length : 0;
  const inventoryVal = inventory.reduce(
    (sum, item) => sum + item.price * item.stock,
    0,
  );

  document.getElementById("rep-kpis-tbody").innerHTML = `
        <tr><td>Total Ventas Históricas</td><td><strong>${sales.length} transacciones</strong></td></tr>
        <tr><td>Ticket Promedio</td><td><strong>${formatMoney(avgTicket)}</strong></td></tr>
        <tr><td>Valor total del Inventario</td><td><strong>${formatMoney(inventoryVal)}</strong></td></tr>
        <tr><td>Productos en Catálogo</td><td><strong>${inventory.length} productos</strong></td></tr>`;

  const maxTbody = document.getElementById("rep-max-tbody");
  const minTbody = document.getElementById("rep-min-tbody");

  if (inventory.length > 0) {
    let maxStockItem = inventory[0],
      minStockItem = inventory[0];
    let mostExpensive = inventory[0],
      cheapest = inventory[0];

    inventory.forEach((item) => {
      if (item.stock > maxStockItem.stock) maxStockItem = item;
      if (item.stock < minStockItem.stock) minStockItem = item;
      if (item.price > mostExpensive.price) mostExpensive = item;
      if (item.price < cheapest.price) cheapest = item;
    });

    maxTbody.innerHTML = `<tr><td>Mayor Stock</td><td>${maxStockItem.name}</td><td><span class="stock-badge stock-high">${maxStockItem.stock} unidades</span></td></tr><tr><td>Mayor Precio</td><td>${mostExpensive.name}</td><td><strong>${formatMoney(mostExpensive.price)}</strong></td></tr>`;
    minTbody.innerHTML = `<tr><td>Menor Stock</td><td>${minStockItem.name}</td><td><span class="stock-badge stock-low">${minStockItem.stock} unidades</span></td></tr><tr><td>Menor Precio</td><td>${cheapest.name}</td><td><strong>${formatMoney(cheapest.price)}</strong></td></tr>`;
  } else {
    maxTbody.innerHTML =
      "<tr><td colspan='3'>Sin datos en el inventario</td></tr>";
    minTbody.innerHTML =
      "<tr><td colspan='3'>Sin datos en el inventario</td></tr>";
  }

  const tbodyDel = document.getElementById("rep-deleted-tbody");
  tbodyDel.innerHTML =
    deletedRecords.length === 0
      ? "<tr><td colspan='4'>No hay registros de eliminaciones.</td></tr>"
      : "";
  deletedRecords
    .slice()
    .reverse()
    .forEach((record) => {
      tbodyDel.innerHTML += `<tr><td>${formatDate(record.date)}</td><td><strong>${record.id}</strong></td><td>${record.name}</td><td style="color:var(--danger)">${record.reason}</td></tr>`;
    });

  const tbodyInc = document.getElementById("rep-incoming-tbody");
  tbodyInc.innerHTML =
    incomingRecords.length === 0
      ? "<tr><td colspan='4'>No hay registros de ingreso.</td></tr>"
      : "";
  incomingRecords
    .slice()
    .reverse()
    .forEach((record) => {
      tbodyInc.innerHTML += `<tr><td>${formatDate(record.date)}</td><td><strong>${record.id}</strong></td><td>${record.name}</td><td style="color:var(--success); font-weight:bold;">+${record.qty} unds.</td></tr>`;
    });
}

// INICIAR APLICACIÓN
window.onload = () => {
  initApp();
};
