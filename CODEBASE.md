# 🗺️ CODEBASE.md - Gestão de Vistorias (PWA / Android WebView)

> **Guia Arquitetural de Referência Rápida para o Agente e Desenvolvedores.**  
> Consulte este arquivo ANTES de realizar qualquer busca cega ou varredura de código.

---

## 📌 Visão Geral da Arquitetura

O sistema é uma aplicação PWA híbrida offline-first e cliente nativo Android WebView (compilado via Gradle).  
Toda a interface roda no navegador ou dentro do aplicativo Android, persistindo dados em `localStorage`, SQLite nativo (Android) e sincronizando com Cloudflare Pages / KV online.

- **Stack:** HTML5, CSS3 puro, JavaScript Vanilla (ES6+), Gradle Wrapper (Android).
- **Hospedagem Web / OTA:** Cloudflare Pages (`inicialsistema.pages.dev`).
- **Repositório:** `https://github.com/albinokira-crypto/inicialsistema.git` (branches `master` e `main`).
- **Versão Atual:** `v2.54.8` (definida em `version.json`, `app.js` e `dashboard.html`).

---

## 📂 Mapa de Arquivos do Projeto

| Arquivo / Diretório | Responsabilidade |
| :--- | :--- |
| `app.js` | Núcleo completo da aplicação: estado, formulários, peças, supervisão, relatórios e fotos (~14.100 linhas). |
| `dashboard.html` | Interface visual principal: formulário de vistoria, seletor de partes, modal de fotos, supervisões e histórico. |
| `index.html` / `login.js` | Tela de autenticação e controle de login. |
| `version.json` | Metadados de versão (`version`, `versionCode`, `changelog`) usados para update OTA automático. |
| `android/` | Projeto nativo Android com WebView, câmera nativa e assets embutidos. |
| `android/app/src/main/assets/` | Cópia espelhada dos assets web (`app.js`, `dashboard.html`, `version.json`, etc.) para execução offline. |
| `styles.css` | Folha de estilos unificada com suporte a design responsivo para desktop e smartphone. |

---

## 🧭 Mapa Seccional do `app.js` (Onde fica cada funcionalidade)

| Linhas Aproximadas | Módulo / Funcionalidade | Funções e Variáveis Chave |
| :--- | :--- | :--- |
| **L1 – L1.500** | Inicialização, Atualização OTA e Menu | `CURRENT_APP_VERSION`, `checkForSystemUpdates`, `backToHomeMenu`, `homeLogout`, filtros |
| **L1.500 – L3.350** | CRUD de Vistorias e Geradores de Texto | `saveItem`, `editItem`, `deleteItem`, `copySurveyText`, `shareSurveyText` |
| **L3.350 – L4.540** | Seguradoras, Oficinas e Campos Dinâmicos | `renderInsurers`, `renderOficinas`, `renderDynamicSurveyFields` (motor, estepe, odômetro) |
| **L4.540 – L5.500** | Pneus, Bateria, Comboboxes e Armazenamento | `formatTireSize`, `toggleBateriaAusente`, `loadItems`, `saveItems`, `getSafeStorage` |
| **L5.500 – L6.600** | Módulo de Supervisão e Geração de PDFs | `renderSupervisaoReport`, `generateSupervisaoReportPDF`, `generateWeeklyReportPDF` (jsPDF) |
| **L6.600 – L7.968** | Câmera, Pastas e Galeria de Fotos | `openPhotoManagerForVehicle`, `saveDirectoryHandle`, seletor de câmera nativa |
| **L7.968 – L13.582** | **SELETOR DE PARTES DO VEÍCULO (ZONAS E ABAS)** | `VP_BASE_ZONES_CAR`, `VP_BASE_ZONES_MOTO`, `vpSetVehicleType`, `vpPartMatchesVehicleType`, `vpLoadAndSortVehicleParts`, `vpRenderParts`, `vpToggleAction`, abas personalizadas (`vpCustomTabs`) |
| **L13.585 – L14.136** | Copiador Inteligente de Pneus e Monitor Diário | `refreshSupervisoesIfDayChanged`, `openTireCopyModal`, `vpGetFilledTires` |

---

## ⚙️ Protocolo Obrigatório de Deploy & Atualização

Toda e qualquer alteração realizada neste projeto **deve seguir os 5 passos**:

1. **Incrementar Versão:** Atualizar `version.json` (version + versionCode), `app.js` (`CURRENT_APP_VERSION`) e `dashboard.html` (`systemAppVersionDisplay`, `serverVersionJsonDisplay`, `downloadApkBtn`).
2. **Sincronizar Assets:** Copiar `app.js`, `dashboard.html` e `version.json` para `android/app/src/main/assets/`.
3. **Deploy Remoto:** `git add .` ; `git commit -m "..."` ; `git push origin master` ; `git push origin master:main` (aciona Cloudflare Pages OTA).
4. **Build APK Local:** Executar `.\gradlew.bat assembleDebug` em `android/`.
5. **Cópia & Release:** Copiar `app-debug.apk` para `Desktop\VistoriaInicial.apk` e `OneDrive\Desktop\vistoria\VistoriaInicial.apk`, e criar release via `gh release create vX.X.X`.
