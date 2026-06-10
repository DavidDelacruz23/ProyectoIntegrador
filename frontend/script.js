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
    // Consulta inicial del mantenimiento: categorias, productos y ventas se cargan desde MySQL.
    await loadMaintenanceData();

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

// --- CONSULTAR MANTENIMIENTO ---
// Consulta listados simples en PHP/MySQL para categorias, productos y ventas.
async function loadMaintenanceData() {
  const [categoryResponse, productResponse, salesResponse, stateResponse] =
    await Promise.all([
      fetch(`${API_BASE_URL}?action=listCategories`),
      fetch(`${API_BASE_URL}?action=listProducts`),
      fetch(`${API_BASE_URL}?action=listSales`),
      fetch(`${API_BASE_URL}?action=getAll`),
    ]);

  const categoryResult = await categoryResponse.json();
  const productResult = await productResponse.json();
  const salesResult = await salesResponse.json();
  const stateResult = await stateResponse.json();

  categories = categoryResult.data || [];
  inventory = cleanData(productResult.data || []);
  sales = salesResult.data || [];
  deletedRecords = stateResult.deletedRecords || [];
  incomingRecords = stateResult.incomingRecords || [];
}

// --- REFRESCAR TABLAS DINAMICAS ---
// Se ejecuta despues de adicionar, modificar o eliminar para no recargar la pagina.
async function refreshMaintenanceTables() {
  await loadMaintenanceData();
  updateCategoryDropdowns();
  renderCategories();
  renderInventory();
  renderReports();
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
  // Captura los datos del formulario de categorias.
  const id = document.getElementById("form-cat-id").value;
  const name = document.getElementById("form-cat-name").value.trim();
  if (!id || !name) return alert("El ID y el nombre son obligatorios");

  if (editingCategoryId) {
    // MODIFICAR: abre el modal con datos actuales y envia cambios al backend.
    const catIndex = categories.findIndex((c) => c.id === editingCategoryId);
    const oldName = categories[catIndex].name;
    const result = await syncWithBackend("updateCategory", {
      id,
      name,
      oldName,
    });
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo actualizar la categoria.");
    }
  } else {
    // ADICIONAR: el backend valida que el ID no exista antes de insertar.
    const result = await syncWithBackend("addCategory", { id, name });
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo registrar la categoria.");
    }
  }

  // CONSULTAR: refresca la tabla dinamica sin recargar la pagina.
  await refreshMaintenanceTables();
  closeModal("category-modal");
};

window.deleteCategory = async function (id) {
  // Busca la categoria localmente para mostrar un mensaje claro al usuario.
  const cat = categories.find((c) => c.id === id);
  if (!cat) return alert("Categoria no encontrada.");

  const isInUse = inventory.some((p) => p.category === cat.name);
  if (isInUse) {
    return alert(
      "No puedes eliminar esta categoria porque hay productos asignados a ella.",
    );
  }

  if (confirm(`¿Seguro que deseas eliminar la categoria ${cat.name}?`)) {
    const reason = prompt("Indique el motivo de eliminacion de la categoria:");
    if (!reason) return;

    // ELIMINAR: envia ID y motivo; PHP valida asociaciones y registra el log en MySQL.
    const result = await syncWithBackend("deleteCategory", { id, reason });
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo eliminar la categoria.");
    }

    // CONSULTAR: actualiza la tabla en pantalla.
    await refreshMaintenanceTables();
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
    document.getElementById("form-prod-stock").value = "1";
  }
  openModal("product-modal");
};

window.saveProduct = async function () {
  // Captura los datos escritos en el formulario/modal de productos.
  const originalId = document.getElementById("form-prod-original-id").value;
  const id = document.getElementById("form-prod-id").value.trim();
  const name = document.getElementById("form-prod-name").value.trim();
  const category = document.getElementById("form-prod-category").value;
  const brand = document.getElementById("form-prod-brand").value.trim();
  const price = parseFloat(document.getElementById("form-prod-price").value);
  const stock = parseInt(document.getElementById("form-prod-stock").value);

  if (!id || !name || !category || !brand || isNaN(price) || isNaN(stock) || price <= 0 || stock <= 0) {
    return alert(
      "Complete todos los campos. El precio y el stock deben ser positivos.",
    );
  }

  const productPayload = { id, name, category, brand, price, stock };

  if (editingProductId) {
    // MODIFICAR: envia los cambios al backend, que valida existencia y valores positivos.
    const result = await syncWithBackend("updateProduct", {
      ...productPayload,
      originalId,
    });
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo actualizar el producto.");
    }
  } else {
    // ADICIONAR: el backend valida que el ID no exista antes de insertar.
    const result = await syncWithBackend("addProduct", productPayload);
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo registrar el producto.");
    }
  }

  // CONSULTAR: refresca la tabla dinamica de productos sin recargar la pagina.
  await refreshMaintenanceTables();
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
  // Confirma la eliminacion antes de enviar la accion al backend.
  const prod = inventory.find((p) => p.id === id);
  if (!prod) return alert("Producto no encontrado.");
  if (!confirm(`¿Seguro que deseas eliminar el producto ${prod.name}?`)) return;

  const reason = prompt(
    "Indique el motivo de la eliminacion (Ej: Dañado, Fuera de catalogo):",
  );
  if (!reason) return;

  // ELIMINAR: PHP borra el producto y guarda el motivo en logs_eliminaciones.
  const result = await syncWithBackend("deleteProduct", { id, reason });
  if (!result || !result.status) {
    return alert(result?.message || "No se pudo eliminar el producto.");
  }

  // CONSULTAR: actualiza la tabla y los reportes con datos recientes.
  await refreshMaintenanceTables();
  alert("Producto eliminado del inventario.");
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

    // ADICIONAR VENTA: se prepara la venta y se descuenta el stock localmente para enviar a PHP.
    cart.forEach((cartItem) => {
      const product = inventory.find((p) => p.id === cartItem.id);
      if (product) product.stock -= cartItem.qty;
    });

    // El backend guarda la venta y actualiza el stock en MySQL.
    const result = await syncWithBackend("confirmSale", {
      sale: newSale,
      inventoryUpdates: inventory,
    });
    if (!result || !result.status) {
      return alert(result?.message || "No se pudo registrar la venta.");
    }

    cart = [];
    alert("¡Venta registrada con éxito!");
    await refreshMaintenanceTables();
    renderPOS();
  });

// --- MÓDULO DE REPORTES ---
function renderReports() {
  // CONSULTAR VENTAS: muestra un listado basico retornado por backend.php?action=listSales.
  const repDateTbody = document.getElementById("rep-date-tbody");
  repDateTbody.innerHTML = "";
  if (sales.length === 0) {
    repDateTbody.innerHTML = `<tr><td colspan='4'>No hay ventas registradas.</td></tr>`;
  } else {
    sales.forEach((sale) => {
      repDateTbody.innerHTML += `<tr><td>${formatDate(sale.date)}</td><td><strong>${sale.id}</strong></td><td>${sale.totalItems} unid.</td><td style="color:var(--success); font-weight:bold;">${formatMoney(sale.total)}</td></tr>`;
    });
  }

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
