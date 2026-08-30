// Valeiros Guerrentes - Main Application Script
class DnD3App {
  constructor() {
    this.activeTab = 'welcome';
    this.creatorStep = 1;
    
    // Initial State for Character Creation
    this.resetNewChar();
    
    // Check Firebase configuration - prioritize saved localStorage if valid, then window.firebaseConfig
    const isConfigValid = (cfg) => cfg && cfg.apiKey && cfg.projectId;
    const localSavedCfg = (() => {
      try { return JSON.parse(localStorage.getItem('dnd3_firebase_config')); } catch(e) { return null; }
    })();
    this.firebaseConfig = isConfigValid(localSavedCfg) ? localSavedCfg : (isConfigValid(window.firebaseConfig) ? window.firebaseConfig : null);
    this.firebaseInitialized = false;
    this.firebaseError = null;

    if (isConfigValid(this.firebaseConfig)) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(this.firebaseConfig);
        }
        window.db = firebase.firestore();
        this.firebaseInitialized = true;
      } catch (e) {
        console.error("Erro ao inicializar o Firebase: ", e);
        this.firebaseError = e.message || String(e);
      }
    } else if (this.firebaseConfig && (this.firebaseConfig.apiKey || this.firebaseConfig.projectId)) {
      this.firebaseError = "Configuração incompleta. 'apiKey' e 'projectId' são obrigatórios.";
    }

    this.users = JSON.parse(localStorage.getItem('dnd3_users')) || [];
    if (!this.users.some(u => u.username === 'diego')) {
      this.users = this.users.filter(u => u.username !== 'mestre' && u.username !== 'jogador1');
      this.users.push({ username: 'diego', password: 'Irons365.', role: 'dm' });
      localStorage.setItem('dnd3_users', JSON.stringify(this.users));
    }
    if (!this.users.some(u => u.username === 'admin')) {
      this.users.push({ username: 'admin', password: 'AdminIrons365.', role: 'admin' });
      localStorage.setItem('dnd3_users', JSON.stringify(this.users));
    }
    this.currentUser = JSON.parse(localStorage.getItem('dnd3_current_user')) || null;

    if (this.firebaseInitialized) {
      this.savedCharacters = [];
      this.dmCombatants = [];
      this.dmTurnIndex = -1;
      this.customMonsters = [];
    } else {
      // Local Storage Fallback if Firebase is not configured yet
      this.savedCharacters = JSON.parse(localStorage.getItem('dnd3_characters')) || [];
      let needsSave = false;
      this.savedCharacters.forEach(c => {
        if (!c.id) {
          c.id = 'char_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
          needsSave = true;
        }
        if (!c.abilitiesTemp || !c.initiativeMods) {
          needsSave = true;
        }
        this.normalizeCharacter(c, true);
      });
      if (needsSave) {
        this.saveCharactersState();
      }
      
      this.dmCombatants = JSON.parse(localStorage.getItem('dnd3_combatants')) || [];
      this.dmTurnIndex = -1;
      this.inviteActive = JSON.parse(localStorage.getItem('dnd3_invite_active')) || false;
      this.playerResponses = JSON.parse(localStorage.getItem('dnd3_player_responses')) || {};
      this.customMonsters = JSON.parse(localStorage.getItem('dnd3_custom_monsters')) || [];
    }

    this.activeSheetId = null;
    this.compendiumSubtab = 'skills';
    this.rulesSearchQuery = '';

    // Initialize after DOM loaded
    window.addEventListener('DOMContentLoaded', () => {
      this.init();
    });

    // Define offline status on close or navigate away
    window.addEventListener('beforeunload', () => {
      if (this.firebaseInitialized && window.db && firebase.auth().currentUser) {
        const uid = firebase.auth().currentUser.uid;
        window.db.collection('users').doc(uid).update({ online: false }).catch(() => {});
      } else if (this.currentUser) {
        const localUser = this.users.find(u => u.username.toLowerCase() === this.currentUser.username.toLowerCase());
        if (localUser) {
          localUser.online = false;
          localStorage.setItem('dnd3_users', JSON.stringify(this.users));
        }
      }
    });

    // Cross-tab LocalStorage Sync
    window.addEventListener('storage', (e) => {
      if ((e.key === 'dnd3_combatants' || e.key === 'dnd3_invite_active' || e.key === 'dnd3_player_responses') && e.newValue) {
        this.dmCombatants = JSON.parse(localStorage.getItem('dnd3_combatants')) || [];
        this.inviteActive = JSON.parse(localStorage.getItem('dnd3_invite_active')) || false;
        this.playerResponses = JSON.parse(localStorage.getItem('dnd3_player_responses')) || {};
        if (this.currentUser && this.currentUser.role === 'dm') {
          this.renderDMCombatTracker();
        } else {
          this.renderPlayerCombatTracker();
        }
      }
    });
    
    // Enable Sound state
    this.soundEnabled = true;

    // Register orientation listeners
    window.addEventListener('resize', () => this.checkBattlefieldOrientation());
    window.addEventListener('orientationchange', () => this.checkBattlefieldOrientation());
  }

  playSound(type) {
    if (!this.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'attack') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'damage') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'heal') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'victory') {
        const now = ctx.currentTime;
        const playNote = (freq, start, duration) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, start);
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.setValueAtTime(0.1, start);
          g.gain.exponentialRampToValueAtTime(0.01, start + duration - 0.02);
          o.start(start);
          o.stop(start + duration);
        };
        playNote(261.63, now, 0.12);
        playNote(329.63, now + 0.12, 0.12);
        playNote(392.00, now + 0.24, 0.12);
        playNote(523.25, now + 0.36, 0.4);
      } else if (type === 'invite') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn('Audio Context failed to play', e);
    }
  }

  showFloatingDamage(element, amount, isHeal) {
    if (!element) return;
    try {
      const rect = element.getBoundingClientRect();
      const div = document.createElement('div');
      div.className = 'floating-damage';
      div.style.color = isHeal ? '#2ecc71' : '#ef4444';
      div.textContent = (isHeal ? '+' : '-') + amount;
      
      div.style.left = `${rect.left + rect.width/2 - 15 + window.scrollX}px`;
      div.style.top = `${rect.top + rect.height/2 - 20 + window.scrollY}px`;
      
      document.body.appendChild(div);
      setTimeout(() => {
        div.remove();
      }, 800);
    } catch (err) {
      console.warn("Floating damage display failed: ", err);
    }
  }

  resetNewChar() {
    this.newChar = {
      name: "",
      player: this.currentUser ? this.currentUser.username : "",
      gender: "Masculino",
      race: "human",
      class: "fighter",
      alignment: "lg",
      level: 1,
      xp: 0,
      xpSessions: [], // Array of { sessionName: string, xpAmt: number }
      deity: "",
      size: "Medium",
      age: "",
      height: "",
      weight: "",
      eyes: "",
      hair: "",
      skin: "",
      abilitiesBase: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      abilitiesTemp: { str: "", dex: "", con: "", int: "", wis: "", cha: "" },
      hpMax: 10,
      currentHp: 10,
      dr: "",
      initiativeMods: [],
      initiativeMisc: 0,
      acArmor: 0,
      acShield: 0,
      acNatural: 0,
      acDeflection: 0,
      acMisc: 0,
      acSize: 0,
      saveFortBase: 0,
      saveFortMagic: 0,
      saveFortMisc: 0,
      saveFortTemp: 0,
      saveRefBase: 0,
      saveRefMagic: 0,
      saveRefMisc: 0,
      saveRefTemp: 0,
      saveWillBase: 0,
      saveWillMagic: 0,
      saveWillMisc: 0,
      saveWillTemp: 0,
      bab: 0,
      sr: 0,
      grappleSize: 0,
      grappleMisc: 0,
      weapons: [],
      skillRanks: {}, // skillKey -> ranks
      skillMisc: {}, // skillKey -> misc modifier
      featsText: "",
      customFeats: [],
      customAbilities: [],
      languages: ["Comum"],
      inventoryText: "",
      coins: { gp: 0, pp: 0, sp: 0, cp: 0 },
      spellsText: "",
      notes: "",
      meleeMisc: 0,
      meleeTemp: 0,
      rangedMisc: 0,
      rangedTemp: 0
    };
  }

  init() {
    this.processSystemLogos();
    const errorDiv = document.getElementById('firebase-config-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    if (window.location.protocol === 'file:') {
      const authErr = document.getElementById('auth-error-msg');
      if (authErr) {
        authErr.innerHTML = `⚠️ Você está acessando via arquivo local (file://). O Firebase Online requer protocolo HTTPS.<br><a href="https://valeiros-guerrentes.vercel.app" target="_blank" style="color: #d4af37; text-decoration: underline; font-weight: bold; display: inline-block; margin-top: 6px;">Clique aqui para abrir o Valeiros Guerrentes Online</a>`;
        authErr.style.display = 'block';
      }
    }

    if (!this.firebaseInitialized) {
      this.switchAuthView('config');
      if (errorDiv && this.firebaseError) {
        errorDiv.textContent = "Erro de conexão: " + this.firebaseError;
        errorDiv.style.display = 'block';
      }
      const loginContainer = document.getElementById('login-container');
      if (loginContainer) loginContainer.style.display = 'flex';
      return;
    }

    // Se inicializado com sucesso, garanta que mostramos a tela de login
    this.switchAuthView('login');

    // Listener para estado de autenticação do Firebase
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        window.db.collection('users').doc(user.uid).get().then((doc) => {
          const userEmail = (user.email || '').toLowerCase();
          const shortUsername = userEmail.split('@')[0];
          
          let data = doc.exists ? doc.data() : {};
          const currentUsername = (data.username || shortUsername || '').toLowerCase();
          
          const isDm = currentUsername === 'diego' || currentUsername === 'mestre' || userEmail.startsWith('diego@') || userEmail.startsWith('mestre@') || data.role === 'dm' || data.role === 'mestre';
          const isAdmin = currentUsername === 'admin' || userEmail.startsWith('admin@') || data.role === 'admin';
          
          let role = isDm ? 'dm' : (isAdmin ? 'admin' : (data.role || 'player'));
          let username = data.username || (isDm ? (currentUsername === 'mestre' ? 'Mestre' : 'Diego') : (isAdmin ? 'Admin' : shortUsername));

          if (doc.exists) {
            if (data.status === 'deleted') {
              alert("Esta conta foi excluída pelo Mestre.");
              firebase.auth().signOut();
              return;
            }
            
            const updates = { online: true, role: role, username: username };
            window.db.collection('users').doc(user.uid).update(updates)
              .catch(e => console.error("Erro ao atualizar status do usuário no Firestore:", e));

            this.currentUser = {
              uid: user.uid,
              username: username,
              role: role
            };
            localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
            this.setupRealtimeListeners();
            this.updateAuthState();
          } else {
            // Re-criar o documento se a conta existe no Auth mas não no Firestore (auto-heal)
            window.db.collection('users').doc(user.uid).set({
              username: username,
              role: role,
              status: 'active',
              online: true
            }).then(() => {
              this.currentUser = {
                uid: user.uid,
                username: username,
                role: role
              };
              localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
              this.setupRealtimeListeners();
              this.updateAuthState();
            }).catch(err => {
              console.error("Erro ao recriar usuário no Firestore:", err);
            });
          }
        }).catch((error) => {
          console.error("Erro ao carregar dados do usuário:", error);
          const savedUser = JSON.parse(localStorage.getItem('dnd3_current_user'));
          if (savedUser && (savedUser.uid === user.uid || savedUser.username.toLowerCase() === user.email.split('@')[0].toLowerCase())) {
            this.currentUser = savedUser;
          } else {
            const shortUsername = user.email.split('@')[0];
            const localUser = this.users.find(u => u.username.toLowerCase() === shortUsername.toLowerCase());
            this.currentUser = {
              uid: user.uid,
              username: localUser ? localUser.username : shortUsername,
              role: localUser ? localUser.role : 'player'
            };
          }
          localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
          this.setupRealtimeListeners();
          this.updateAuthState();
        });
      } else {
        this.currentUser = null;
        localStorage.removeItem('dnd3_current_user');
        
        // Desinscrever os listeners do Firebase
        if (this.charactersListener) this.charactersListener();
        if (this.combatantsListener) this.combatantsListener();
        if (this.logsListener) this.logsListener();

        this.savedCharacters = [];
        this.dmCombatants = [];
        this.updateAuthState();
      }
    });
  }

  updateAuthState() {
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const userDisplayName = document.getElementById('user-display-name');
    const btnDm = document.getElementById('btn-dm');

    if (!this.currentUser) {
      if (loginContainer) loginContainer.style.display = 'flex';
      if (appContainer) appContainer.style.display = 'none';
      return;
    }

    if (loginContainer) loginContainer.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    if (userDisplayName) {
      const roleText = this.currentUser.role === 'dm' ? 'Mestre' : (this.currentUser.role === 'admin' ? 'Administrador' : 'Jogador');
      userDisplayName.textContent = `${roleText}: ${this.currentUser.username}`;
    }

    if (btnDm) {
      btnDm.style.display = 'inline-block';
    }
    const btnManagePlayers = document.getElementById('btn-manage-players');
    const btnEnemyCreator = document.getElementById('btn-enemy-creator');
    const isDmUser = this.currentUser && this.normalizeRole(this.currentUser.role) === 'dm';
    const isAdminUser = this.currentUser && this.normalizeRole(this.currentUser.role) === 'admin';
    if (btnManagePlayers) {
      btnManagePlayers.style.display = (isDmUser || isAdminUser) ? 'inline-block' : 'none';
    }
    if (btnEnemyCreator) {
      btnEnemyCreator.style.display = (isDmUser || isAdminUser) ? 'inline-block' : 'none';
    }

    if (!this.firebaseInitialized) {
      this.renderWelcomeScreenLocal();
    }

    // Load tabs and views with error protection
    try { this.switchTab(this.activeTab); } catch(e) { console.error('[updateAuthState] switchTab error:', e); }
    try { this.renderNewCharacterSheet(); } catch(e) { console.error('[updateAuthState] renderNewCharacterSheet error:', e); }
    try { this.renderSavedSheetsList(); } catch(e) { console.error('[updateAuthState] renderSavedSheetsList error:', e); }
    try {
      if (isDmUser || isAdminUser) {
        this.renderDMCombatTracker();
      } else {
        this.renderPlayerCombatTracker();
      }
    } catch(e) { console.error('[updateAuthState] renderCombatTracker error:', e); }
    try { this.renderCompendium(); } catch(e) { console.error('[updateAuthState] renderCompendium error:', e); }
  }

  processSystemLogos() {
    const images = document.querySelectorAll('.system-logo-img');
    images.forEach(img => {
      if (img.complete) {
        this.makeImageBackgroundTransparent(img);
      } else {
        img.addEventListener('load', () => {
          this.makeImageBackgroundTransparent(img);
        }, { once: true });
      }
    });
  }

  normalizeRole(role) {
    if (!role) return '';
    return String(role).trim().toLowerCase();
  }

  makeImageBackgroundTransparent(imgElement, tolerance = 40) {
    if (!imgElement) return;
    if (imgElement.dataset.processed === 'true' || imgElement.src.startsWith('data:')) return;
    imgElement.dataset.processed = 'true';
    
    const tempImg = new Image();
    tempImg.crossOrigin = "anonymous";
    tempImg.src = imgElement.src;
    
    tempImg.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempImg.width;
        canvas.height = tempImg.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // Assume the top-left pixel is the background color
        const targetR = data[0];
        const targetG = data[1];
        const targetB = data[2];
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const distance = Math.sqrt(
            Math.pow(r - targetR, 2) +
            Math.pow(g - targetG, 2) +
            Math.pow(b - targetB, 2)
          );
          
          if (distance < tolerance) {
            data[i+3] = 0; // Make transparent
          }
        }
        
        ctx.putImageData(imgData, 0, 0);
        imgElement.src = canvas.toDataURL();
      } catch (err) {
        console.warn("Could not make image background transparent (likely filesystem origin restriction):", err);
      }
    };
  }

  // AUTHENTICATION LOGIC
  switchAuthView(view) {
    const loginView = document.getElementById('auth-view-login');
    const registerView = document.getElementById('auth-view-register');
    const configView = document.getElementById('auth-view-config');
    const errorMsg = document.getElementById('auth-error-msg');
    
    if (errorMsg) errorMsg.style.display = 'none';

    if (view === 'login') {
      if (loginView) loginView.style.display = 'block';
      if (registerView) registerView.style.display = 'none';
      if (configView) configView.style.display = 'none';
    } else if (view === 'register') {
      if (loginView) loginView.style.display = 'none';
      if (registerView) registerView.style.display = 'block';
      if (configView) configView.style.display = 'none';
    } else if (view === 'config') {
      if (loginView) loginView.style.display = 'none';
      if (registerView) registerView.style.display = 'none';
      if (configView) configView.style.display = 'block';
      
      const configTextarea = document.getElementById('auth-fb-config-text');
      if (configTextarea) {
        if (this.firebaseConfig && this.firebaseConfig.apiKey) {
          configTextarea.value = JSON.stringify(this.firebaseConfig, null, 2);
        } else {
          configTextarea.value = "";
        }
      }
    }
  }

  login() {
    const userEl = document.getElementById('auth-login-username');
    const passEl = document.getElementById('auth-login-password');
    const errorMsg = document.getElementById('auth-error-msg');

    if (!userEl || !passEl) return;

    const username = userEl.value.trim().toLowerCase();
    const password = passEl.value.trim();

    if (this.firebaseInitialized) {
      if (password.length < 6) {
        if (errorMsg) {
          errorMsg.textContent = 'Erro: A senha deve ter pelo menos 6 caracteres no Firebase.';
          errorMsg.style.display = 'block';
        }
        return;
      }
      
      const email = username + "@valeiros.com";
      firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
          userEl.value = '';
          passEl.value = '';
          if (errorMsg) errorMsg.style.display = 'none';
          this.logAction("Usuário realizou login no sistema.");

          const user = userCredential.user;
          const db = window.db;
          if (db && user) {
            db.collection('users').doc(user.uid).set({
              username: username,
              online: true,
              password: password
            }, { merge: true }).catch(err => {
              console.log("Could not update online status in Firestore user doc:", err);
            });
          }
        })
        .catch((error) => {
          console.error("Erro de autenticação:", error.code, error.message);
          
          const db = window.db;
          db.collection('users').where('username', '==', username).get()
            .then((snapshot) => {
              if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data();
                if (userData.status === 'deleted') {
                  if (errorMsg) {
                    errorMsg.textContent = 'Erro: Esta conta foi excluída.';
                    errorMsg.style.display = 'block';
                  }
                  return;
                }
                if (userData.password && userData.password === password) {
                  userEl.value = '';
                  passEl.value = '';
                  if (errorMsg) errorMsg.style.display = 'none';
                  
                  this.currentUser = {
                    uid: userDoc.id,
                    username: userData.username,
                    role: userData.role
                  };
                  localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
                  
                  db.collection('users').doc(userDoc.id).update({ online: true, forceLogout: false }).catch(() => {});
                  
                  this.setupRealtimeListeners();
                  this.updateAuthState();
                  this.logAction("Usuário realizou login via Firestore (recuperação de senha).");
                  return;
                }
              }
              
              // Try to auto-register default users on any kind of auth failure
              // (covers auth/user-not-found, auth/invalid-credential, auth/invalid-login-credentials)
              const isDefaultUser = (username === 'diego' && password === 'Irons365.') || (username === 'admin' && password === 'AdminIrons365.');
              const isAuthError = ['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/user-disabled'].includes(error.code);
              
              if (isDefaultUser && isAuthError) {
                const role = username === 'diego' ? 'dm' : 'admin';
                const displayUsername = username === 'diego' ? 'Diego' : 'admin';
                
                firebase.auth().createUserWithEmailAndPassword(email, password)
                  .then((userCredential) => {
                    const user = userCredential.user;
                    this.currentUser = {
                      uid: user.uid,
                      username: displayUsername,
                      role: role
                    };
                    localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
                    
                    return db.collection('users').doc(user.uid).set({
                      username: displayUsername,
                      role: role,
                      status: 'active',
                      password: password
                    });
                  })
                  .then(() => {
                    userEl.value = '';
                    passEl.value = '';
                    if (errorMsg) errorMsg.style.display = 'none';
                    this.logAction("Usuário auto-registrado e logado.");
                    this.setupRealtimeListeners();
                    this.updateAuthState();
                  })
                  .catch(regErr => {
                    console.error("Erro no auto-registro:", regErr.code, regErr.message);
                    if (regErr.code === 'auth/email-already-in-use') {
                      if (errorMsg) {
                        errorMsg.textContent = 'Conta já existe mas a senha pode ter sido alterada. Entre em contato com o Mestre.';
                        errorMsg.style.display = 'block';
                      }
                    } else {
                      if (errorMsg) {
                        errorMsg.textContent = 'Erro ao realizar login: ' + (regErr.message || regErr.code || 'Erro desconhecido');
                        errorMsg.style.display = 'block';
                      }
                    }
                  });
                return;
              }

              if (error.code === 'auth/too-many-requests') {
                if (errorMsg) {
                  errorMsg.textContent = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
                  errorMsg.style.display = 'block';
                }
                return;
              }

              if (errorMsg) {
                errorMsg.textContent = 'Erro: Usuário ou senha incorretos. (Código: ' + (error.code || 'desconhecido') + ')';
                errorMsg.style.display = 'block';
              }
            })
            .catch((dbErr) => {
              console.error("Erro ao verificar usuário no Firestore:", dbErr);
              if (errorMsg) {
                errorMsg.textContent = 'Erro de autenticação: ' + (dbErr.message || 'Verifique sua conexão.');
                errorMsg.style.display = 'block';
              }
            });
        });
    } else {
      const user = this.users.find(u => u.username.toLowerCase() === username && u.password === password);

      if (user) {
          this.currentUser = user;
          localStorage.setItem('dnd3_current_user', JSON.stringify(user));
          userEl.value = '';
          passEl.value = '';
          if (errorMsg) errorMsg.style.display = 'none';
          this.updateAuthState();
          this.logAction("Usuário realizou login no sistema.");
      } else {
        if (errorMsg) {
          errorMsg.textContent = 'Erro: Usuário ou senha incorretos.';
          errorMsg.style.display = 'block';
        }
      }
    }
  }

  register() {
    const userEl = document.getElementById('auth-reg-username');
    const passEl = document.getElementById('auth-reg-password');
    const roleEl = document.getElementById('auth-reg-role');
    const errorMsg = document.getElementById('auth-error-msg');

    if (!userEl || !passEl || !roleEl) return;

    const username = userEl.value.trim().toLowerCase();
    const password = passEl.value.trim();
    const role = roleEl.value;

    if (username.length < 3) {
      if (errorMsg) {
        errorMsg.textContent = 'Erro: O nome de usuário deve ter pelo menos 3 caracteres.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (password.length < 6 && this.firebaseInitialized) {
      if (errorMsg) {
        errorMsg.textContent = 'Erro: A senha deve ter pelo menos 6 caracteres.';
        errorMsg.style.display = 'block';
      }
      return;
    } else if (password.length < 3 && !this.firebaseInitialized) {
      if (errorMsg) {
        errorMsg.textContent = 'Erro: A senha deve ter pelo menos 3 caracteres.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (this.firebaseInitialized) {
      const email = username + "@valeiros.com";
      const db = window.db;
      db.collection('users').where('username', '==', username).get()
        .then((querySnapshot) => {
          if (!querySnapshot.empty) {
            throw new Error("username_taken");
          }
          return firebase.auth().createUserWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
          const user = userCredential.user;
          this.currentUser = {
            uid: user.uid,
            username: username,
            role: role
          };
          localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
          
          // Adicionar também na lista local como redundância
          const localNewUser = { username, password, role };
          if (!this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            this.users.push(localNewUser);
            localStorage.setItem('dnd3_users', JSON.stringify(this.users));
          }

          return db.collection('users').doc(user.uid).set({
            username: username,
            role: role,
            status: 'active',
            password: password
          });
        })
        .then(() => {
          userEl.value = '';
          passEl.value = '';
          if (errorMsg) errorMsg.style.display = 'none';
          this.logAction(`Novo jogador registrado: "${username}" com a função: ${role === 'dm' ? 'Mestre' : 'Jogador'}.`, username);
        })
        .catch((error) => {
          console.error("Erro no registro:", error);
          if (errorMsg) {
            if (error.message === "username_taken" || error.code === 'auth/email-already-in-use') {
              errorMsg.textContent = 'Erro: Este nome de usuário já está registrado.';
            } else {
              errorMsg.textContent = 'Erro ao realizar cadastro: ' + error.message;
            }
            errorMsg.style.display = 'block';
          }
        });
    } else {
      const exists = this.users.some(u => u.username.toLowerCase() === username);
      if (exists) {
        if (errorMsg) {
          errorMsg.textContent = 'Erro: Este nome de usuário já está registrado.';
          errorMsg.style.display = 'block';
        }
        return;
      }

      const newUser = { username, password, role };
      this.users.push(newUser);
      localStorage.setItem('dnd3_users', JSON.stringify(this.users));

      this.currentUser = newUser;
      localStorage.setItem('dnd3_current_user', JSON.stringify(newUser));

      userEl.value = '';
      passEl.value = '';
      if (errorMsg) errorMsg.style.display = 'none';
      this.updateAuthState();
      this.logAction(`Novo jogador registrado (Local): "${username}" com a função: ${role === 'dm' ? 'Mestre' : 'Jogador'}.`, username);
    }
  }

  logout() {
    this.logAction("Usuário saiu do sistema.");
    if (this.firebaseInitialized && window.db) {
      const user = firebase.auth().currentUser;
      if (user) {
        window.db.collection('users').doc(user.uid).update({ online: false })
          .catch(err => console.error("Erro ao definir offline no logout:", err))
          .finally(() => {
            firebase.auth().signOut().then(() => {
              this.activeTab = 'welcome';
            }).catch(err => {
              console.error("Erro no logout:", err);
            });
          });
        return;
      }
    }
    
    // Local / fallback mode
    if (this.currentUser) {
      const localUser = this.users.find(u => u.username.toLowerCase() === this.currentUser.username.toLowerCase());
      if (localUser) {
        localUser.online = false;
        localStorage.setItem('dnd3_users', JSON.stringify(this.users));
      }
    }
    this.currentUser = null;
    localStorage.removeItem('dnd3_current_user');
    this.activeTab = 'welcome';
    this.updateAuthState();
  }

  saveFirebaseConfig() {
    const configText = document.getElementById('auth-fb-config-text').value.trim();
    
    if (configText === "") {
      localStorage.removeItem('dnd3_firebase_config');
      alert("Configuração do Firebase removida. O sistema usará o armazenamento local (localStorage).");
      window.location.reload();
      return;
    }
    
    const parsedConfig = {};
    const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    keys.forEach(key => {
      const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`);
      const match = configText.match(regex);
      if (match) {
        parsedConfig[key] = match[1];
      } else {
        parsedConfig[key] = "";
      }
    });

    if (!parsedConfig.apiKey || !parsedConfig.projectId) {
      alert("Configuração inválida. Certifique-se de colar o objeto firebaseConfig completo contendo pelo menos apiKey e projectId.");
      return;
    }

    localStorage.setItem('dnd3_firebase_config', JSON.stringify(parsedConfig));
    alert("Configuração do Firebase salva com sucesso! O sistema será reiniciado para conectar.");
    window.location.reload();
  }

  setupRealtimeListeners() {
    if (!this.firebaseInitialized || !window.db) return;
    const db = window.db;

    if (this.charactersListener) this.charactersListener();
    if (this.combatantsListener) this.combatantsListener();
    if (this.logsListener) this.logsListener();
    if (this.chronicleListener) this.chronicleListener();
    if (this.usersListener) this.usersListener();

    let charQuery = db.collection('characters');
    this.charactersListener = charQuery.onSnapshot((snapshot) => {
      const allChars = [];
      snapshot.forEach((doc) => {
        const char = doc.data();
        char.id = doc.id;
        this.normalizeCharacter(char, true);
        allChars.push(char);
      });
      
      const currentOwner = (this.currentUser ? this.currentUser.username : '').toLowerCase();
      const isPlayer = this.currentUser && this.normalizeRole(this.currentUser.role) === 'player';
      
      if (isPlayer) {
        this.savedCharacters = allChars.filter(c => c.owner && c.owner.toLowerCase() === currentOwner);
      } else {
        this.savedCharacters = allChars;
      }

      this.renderSavedSheetsList();
      
      if (this.activeSheetId) {
        const currentActive = this.savedCharacters.find(c => c.id === this.activeSheetId);
        if (currentActive) {
          const detailView = document.getElementById('sheet-detail-view');
          if (detailView && detailView.style.display === 'block') {
            this.renderCharacterSheetDetails(currentActive, detailView);
          }
        }
      }
    }, (error) => {
      console.error("Erro ao escutar personagens: ", error);
      this.handleFirebasePermissionError(error);
      this.savedCharacters = JSON.parse(localStorage.getItem('dnd3_characters')) || [];
      this.renderSavedSheetsList();
    });

    this.combatantsListener = db.collection('combat').doc('state').onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const prevRound = this.combatRound || 1;
        this.dmCombatants = data.combatants || [];
        this.dmTurnIndex = data.turnIndex !== undefined ? data.turnIndex : -1;
        this.combatRound = data.combatRound || 1;
        this.lastRoundMessage = data.lastRoundMessage || '';
        this.inviteActive = data.inviteActive || false;
        this.invitedMonsters = data.invitedMonsters || [];
        this.playerResponses = data.playerResponses || {};

        if (!this.hasInitialCombatSyncDone) {
          this.hasInitialCombatSyncDone = true;
          this.lastResurrectEvent = data.lastResurrectEvent || null;
          this.lastDefeatedEvent = data.lastDefeatedEvent || null;
        } else {
          if (data.lastResurrectEvent && (!this.lastResurrectEvent || data.lastResurrectEvent.time > (this.lastResurrectEvent.time || 0))) {
            this.lastResurrectEvent = data.lastResurrectEvent;
            this.triggerAngelResurrectAnimation(data.lastResurrectEvent.charName, data.lastResurrectEvent.hp);
          }

          if (data.lastDefeatedEvent && (!this.lastDefeatedEvent || data.lastDefeatedEvent.time > (this.lastDefeatedEvent.time || 0))) {
            this.lastDefeatedEvent = data.lastDefeatedEvent;
            this.triggerDefeatedAnimation(data.lastDefeatedEvent.charName);
          }

          if (this.combatRound > prevRound) {
            this.triggerNextRoundBanner(this.combatRound);
            this.showToast(`🔄 Rodada ${this.combatRound} - Próxima Rodada!`);
          }
        }
      } else {
        this.hasInitialCombatSyncDone = false;
        this.dmCombatants = [];
        this.dmTurnIndex = -1;
        this.combatRound = 1;
        this.lastRoundMessage = '';
        this.inviteActive = false;
        this.invitedMonsters = [];
        this.playerResponses = {};
      }

      // Sync HP from combat state back to savedCharacters so player sheets reflect damage
      if (this.dmCombatants && this.savedCharacters) {
        this.dmCombatants.forEach(combatant => {
          if (combatant.type === 'player' && combatant.charId) {
            const char = this.savedCharacters.find(c => c.id === combatant.charId);
            if (char && char.currentHp !== combatant.currentHp) {
              char.currentHp = combatant.currentHp;
            }
          }
        });
      }

      // Update Nav button indicator for Battle Invite
      const btnDm = document.getElementById('btn-dm');
      if (btnDm) {
        const isPlayer = this.currentUser && this.normalizeRole(this.currentUser.role) === 'player';
        const userResp = this.currentUser ? (this.playerResponses[this.currentUser.username] || 'invited') : 'invited';
        if (isPlayer && this.inviteActive && userResp !== 'accepted') {
          btnDm.innerHTML = '⚔️ Ações de batalha <span style="background:#ef4444; color:#fff; padding:2px 6px; border-radius:10px; font-size:0.7rem; margin-left:4px; font-weight:bold;">CONVITE!</span>';
        } else {
          btnDm.innerHTML = 'Ações de batalha';
        }
      }

      if (this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin')) {
        this.renderDMCombatTracker();
      } else {
        this.renderPlayerCombatTracker();
      }

      this.renderGlobalBattleInviteModal();
    }, (error) => {
      console.error("Erro ao escutar combate: ", error);
      this.handleFirebasePermissionError(error);
    });

    this.logsListener = db.collection('logs')
      .orderBy('timestampRaw', 'desc')
      .limit(100)
      .onSnapshot((snapshot) => {
        this.loadedLogs = [];
        snapshot.forEach((doc) => {
          this.loadedLogs.push(doc.data());
        });
        this.renderAuditLogs();
      }, (error) => {
        console.error("Erro ao escutar logs: ", error);
        this.handleFirebasePermissionError(error);
        this.renderAuditLogs();
      });

    // Ouvir alterações na crônica da campanha
    this.chronicleListener = db.collection('campaign').doc('chronicle').onSnapshot((doc) => {
      const titleEl = document.getElementById('chronicle-title');
      const descEl = document.getElementById('chronicle-desc');
      const editBtn = document.getElementById('btn-edit-chronicle');
      
      if (doc.exists) {
        const data = doc.data();
        this.chronicleData = data;
        if (titleEl) titleEl.textContent = data.title || "Crônica Sem Nome";
        if (descEl) descEl.textContent = data.description || "Sem sinopse definida.";
      } else {
        this.chronicleData = { title: "Valeiros Guerrentes - Crônica Ativa", description: "O Mestre pode editar este texto para contar a sinopse da aventura." };
        if (titleEl) titleEl.textContent = this.chronicleData.title;
        if (descEl) descEl.textContent = this.chronicleData.description;
      }
      
      if (editBtn) {
        editBtn.style.display = (this.currentUser && (this.currentUser.role === 'dm' || this.currentUser.role === 'admin')) ? 'inline-block' : 'none';
      }
    }, (error) => {
      console.error("Erro ao escutar crônica: ", error);
      this.handleFirebasePermissionError(error);
    });

    // Ouvir lista de usuários da mesa
    this.usersListener = db.collection('users').onSnapshot((snapshot) => {
      const dmListEl = document.getElementById('welcome-dm-list');
      const playersListEl = document.getElementById('welcome-players-list');
      
      let dmNames = [];
      let playersHtml = [];
      let foundCurrentUser = false;
      
      snapshot.forEach((doc) => {
        const user = doc.data();
        user.uid = doc.id;
        if (user.status === 'deleted') return;
        
        if (this.currentUser && user.username.toLowerCase() === this.currentUser.username.toLowerCase()) {
          foundCurrentUser = true;
          if (user.forceLogout === true) {
            db.collection('users').doc(doc.id).update({ forceLogout: false }).then(() => {
              alert("O Mestre ou Administrador forçou sua desconexão do sistema.");
              this.logout();
            }).catch(() => {
              this.logout();
            });
          }
        }
        
        const isDm = this.normalizeRole(user.role) === 'dm' || user.username.toLowerCase() === 'diego' || user.username.toLowerCase() === 'mestre';
        const isOnline = user.online === true || (this.currentUser && user.username.toLowerCase() === this.currentUser.username.toLowerCase());
        
        if (!isOnline) return;

        if (isDm) {
          dmNames.push(`<span style="color:#66cc66;">●</span> ${user.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(Online)</span>`);
        } else {
          const status = user.status || 'active';
          const statusText = 'Online';
          const statusColor = '#66cc66';
          const statusDot = '●';
          const statusBtnLabel = status === 'inactive' ? 'Ativar' : 'Desativar';
          
          let dmActions = '';
          if (this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin')) {
            dmActions = `
              <div style="display: flex; gap: 6px; margin-left: auto; align-items: center;">
                <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.7rem; background-color: #d97706; border-color: transparent;" onclick="app.forcePlayerLogout('${user.uid}', '${user.username}')" title="Forçar Logoff">Desconectar ⏻</button>
                <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.7rem; background-color: ${status === 'inactive' ? '#449944' : '#994444'}; border-color: transparent;" onclick="app.togglePlayerStatus('${user.uid}', '${status}')">${statusBtnLabel}</button>
                <button class="rpg-btn rpg-btn-secondary" style="padding: 2px 6px; font-size: 0.7rem; border-color: #ff4444; color: #ff4444;" onclick="app.deletePlayer('${user.uid}', '${user.username}')">Excluir</button>
              </div>
            `;
          }

          playersHtml.push(`<li style="color: var(--text-parchment); font-size: 0.95rem; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;">
            <span style="color: ${statusColor};">${statusDot}</span> 
            <span>${user.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(${statusText})</span></span>
            ${dmActions}
          </li>`);
        }
      });

      if (!foundCurrentUser && this.currentUser) {
        const isDm = this.normalizeRole(this.currentUser.role) === 'dm' || this.currentUser.username.toLowerCase() === 'diego' || this.currentUser.username.toLowerCase() === 'mestre';
        if (isDm) {
          dmNames.push(`<span style="color:#66cc66;">●</span> ${this.currentUser.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(Online)</span>`);
        } else {
          playersHtml.push(`<li style="color: var(--text-parchment); font-size: 0.95rem; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;">
            <span style="color: #66cc66;" title="Ativo">●</span> 
            <span>${this.currentUser.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(Ativo)</span></span>
          </li>`);
        }
      }
      
      if (dmListEl) {
        if (dmNames.length > 0) {
          dmListEl.innerHTML = dmNames.join(', ');
        } else {
          dmListEl.innerHTML = `<span style="color:#66cc66;">●</span> Diego <span style="font-size: 0.75rem; color: var(--text-muted);">(Online)</span>`;
        }
      }
      
      if (playersListEl) {
        if (playersHtml.length > 0) {
          playersListEl.innerHTML = playersHtml.join('');
        } else {
          playersListEl.innerHTML = `<li style="color: var(--text-muted); font-style: italic;">Nenhum jogador cadastrado.</li>`;
        }
      }

      if (this.activeTab === 'manage-players') {
        this.renderManagePlayersTab();
      }
    }, (error) => {
      console.error("Erro ao escutar usuários: ", error);
      this.handleFirebasePermissionError(error);
      this.renderWelcomeScreenLocal();
    });

    // Ouvir monstros customizados (Mestre)
    if (this.customMonstersListener) this.customMonstersListener();
    this.customMonstersListener = db.collection('custom_monsters').onSnapshot((snapshot) => {
      this.customMonsters = [];
      snapshot.forEach((doc) => {
        const mon = doc.data();
        mon.id = doc.id;
        this.customMonsters.push(mon);
      });
      localStorage.setItem('dnd3_custom_monsters', JSON.stringify(this.customMonsters));
      this.dmNpcFilterMonsters(document.getElementById('dm-npc-search')?.value || '');
      this.renderCustomMonstersList();
      this.dmSceneFilterCustomMonsters(document.getElementById('dm-scene-monster-custom-search')?.value || '');
    }, (error) => {
      console.error("Erro ao escutar monstros customizados: ", error);
      this.customMonsters = JSON.parse(localStorage.getItem('dnd3_custom_monsters')) || [];
      this.renderCustomMonstersList();
      this.dmSceneFilterCustomMonsters(document.getElementById('dm-scene-monster-custom-search')?.value || '');
    });
  }

  saveCharactersState(deletedId = null) {
    localStorage.setItem('dnd3_characters', JSON.stringify(this.savedCharacters));

    // Sincroniza automaticamente os atributos do personagem na batalha se ele estiver nela
    if (this.dmCombatants) {
      let combatUpdated = false;
      this.savedCharacters.forEach(char => {
        const combatant = this.dmCombatants.find(c => c.charId === char.id && c.type === 'player');
        if (combatant) {
          const stats = this.calculateActiveStats(char);
          if (
            combatant.level !== char.level ||
            combatant.class !== char.class ||
            combatant.maxHp !== stats.maxHp ||
            combatant.ac !== stats.ac ||
            combatant.initMod !== (stats.initiative || 0) ||
            combatant.name !== char.name
          ) {
            combatant.name = char.name;
            combatant.level = char.level || 1;
            combatant.class = char.class || 'fighter';
            combatant.maxHp = stats.maxHp;
            combatant.ac = stats.ac;
            combatant.initMod = stats.initiative || 0;
            if (combatant.currentHp > combatant.maxHp) {
              combatant.currentHp = combatant.maxHp;
            }
            combatUpdated = true;
          }
        }
      });
      if (combatUpdated) {
        this.saveCombatState();
        setTimeout(() => {
          const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
          if (shouldRenderDmView) {
            this.renderDMCombatTracker();
          } else {
            this.renderPlayerCombatTracker();
          }
        }, 0);
      }
    }

    if (this.firebaseInitialized && window.db) {
      const db = window.db;
      if (deletedId) {
        db.collection('characters').doc(deletedId).delete().catch(err => console.error("Erro ao deletar: ", err));
      }
      
      this.savedCharacters.forEach(char => {
        if (char.id) {
          if (this.currentUser && this.currentUser.role === 'player' && char.owner && char.owner !== this.currentUser.username) {
             return;
          }
          db.collection('characters').doc(char.id).set(char).catch(err => console.error("Erro ao salvar personagem: ", err));
        }
      });
    }
  }

  saveCombatState() {
    localStorage.setItem('dnd3_combatants', JSON.stringify(this.dmCombatants));
    localStorage.setItem('dnd3_combat_round', JSON.stringify(this.combatRound || 1));
    localStorage.setItem('dnd3_invite_active', JSON.stringify(this.inviteActive || false));
    localStorage.setItem('dnd3_invited_monsters', JSON.stringify(this.invitedMonsters || []));
    localStorage.setItem('dnd3_player_responses', JSON.stringify(this.playerResponses || {}));

    if (this.firebaseInitialized && window.db) {
      const db = window.db;
      db.collection('combat').doc('state').set({
        combatants: this.dmCombatants,
        turnIndex: this.dmTurnIndex,
        combatRound: this.combatRound || 1,
        lastRoundMessage: this.lastRoundMessage || '',
        lastResurrectEvent: this.lastResurrectEvent || null,
        lastDefeatedEvent: this.lastDefeatedEvent || null,
        inviteActive: this.inviteActive || false,
        invitedMonsters: this.invitedMonsters || [],
        playerResponses: this.playerResponses || {}
      }).catch(err => console.error("Erro ao salvar estado do combate: ", err));
    }
  }

  // NAVIGATION TABS
  switchTab(tabId) {
    this.activeTab = tabId;
    
    // Toggle header visibility for Battlefield maximized view
    const appHeader = document.querySelector('.app-header');
    if (appHeader) {
      if (tabId === 'dm') {
        appHeader.style.setProperty('display', 'none', 'important');
      } else {
        appHeader.style.removeProperty('display');
      }
    }
    
    // Fechar menu mobile se estiver aberto
    const navLinks = document.querySelector('.nav-links');
    const headerDiv = document.querySelector('.app-header > div:not(.logo)');
    if (navLinks) navLinks.classList.remove('menu-open');
    if (headerDiv) headerDiv.classList.remove('menu-open');

    // Update nav buttons active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Hide all tabs
    const tabWelcome = document.getElementById('tab-welcome');
    if (tabWelcome) tabWelcome.style.display = 'none';
    const tabManagePlayers = document.getElementById('tab-manage-players');
    if (tabManagePlayers) tabManagePlayers.style.display = 'none';
    const tabEnemyCreator = document.getElementById('tab-enemy-creator');
    if (tabEnemyCreator) tabEnemyCreator.style.display = 'none';
    document.getElementById('tab-creator').style.display = 'none';
    document.getElementById('tab-sheets').style.display = 'none';
    document.getElementById('tab-dm').style.display = 'none';
    document.getElementById('tab-rules').style.display = 'none';
    const tabDice = document.getElementById('tab-dice');
    if (tabDice) tabDice.style.display = 'none';
    const tabLogs = document.getElementById('tab-logs');
    if (tabLogs) tabLogs.style.display = 'none';

    // Show selected
    const selectedTab = document.getElementById(`tab-${tabId}`);
    if (selectedTab) selectedTab.style.display = 'block';

    if (tabId === 'sheets') {
      this.renderSavedSheetsList();
    } else if (tabId === 'dm') {
      const dmView = document.getElementById('dm-view-container');
      const playerView = document.getElementById('player-view-container');
      const normalizedRole = this.currentUser ? this.normalizeRole(this.currentUser.role) : '';
      const isDmOrAdmin = normalizedRole === 'dm' || normalizedRole === 'admin';
      if (isDmOrAdmin) {
        if (dmView) dmView.style.display = 'block';
        if (playerView) playerView.style.display = 'none';
        this.renderDMCombatTracker();
      } else {
        if (dmView) dmView.style.display = 'none';
        if (playerView) playerView.style.display = 'block';
        this.renderPlayerCombatTracker();
      }
    } else if (tabId === 'rules') {
      this.renderCompendium();
    } else if (tabId === 'creator') {
      localStorage.removeItem('dnd3_new_char');
      this.resetNewChar();
      const isDmUser = this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin');
      this.creatorStep = isDmUser ? 'sheet' : 'photo';
      this.renderNewCharacterSheet();
    } else if (tabId === 'dice') {
      this.populateDiceCharacterSelect();
    } else if (tabId === 'manage-players') {
      this.renderManagePlayersTab();
    } else if (tabId === 'enemy-creator') {
      this.renderCustomMonstersList();
      this.populateEnemyCreatorSpellSuggestions();
      this.populateEnemyCreatorSpecialSuggestions();
      this.populateEnemyCreatorWeaponSuggestions();
    } else if (tabId === 'logs') {
      this.renderAuditLogs();
    }
    this.checkBattlefieldOrientation();
  }

  checkBattlefieldOrientation() {
    const warning = document.getElementById('battle-orientation-warning');
    const dmView = document.getElementById('dm-view-container');
    const playerView = document.getElementById('player-view-container');
    if (!warning) return;

    if (this.activeTab !== 'dm') {
      warning.style.display = 'none';
      return;
    }

    const isMobileSize = window.innerWidth < 768;
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isMobileSize && isPortrait) {
      warning.style.setProperty('display', 'block', 'important');
      if (dmView) dmView.style.setProperty('display', 'none', 'important');
      if (playerView) playerView.style.setProperty('display', 'none', 'important');
      const controls = document.querySelector('.battlefield-header-controls');
      if (controls) controls.style.setProperty('display', 'none', 'important');
    } else {
      warning.style.setProperty('display', 'none', 'important');
      const controls = document.querySelector('.battlefield-header-controls');
      if (controls) controls.style.setProperty('display', 'flex', 'important');
      // Restabelecer visualização correta
      if (this.currentUser && this.currentUser.role === 'dm') {
        if (dmView) dmView.style.setProperty('display', 'block', 'important');
        if (playerView) playerView.style.setProperty('display', 'none', 'important');
      } else {
        if (dmView) dmView.style.setProperty('display', 'none', 'important');
        if (playerView) playerView.style.setProperty('display', 'block', 'important');
      }
    }
  }

  populateDiceCharacterSelect() {
    const select = document.getElementById('dice-character-select');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Jogador Geral --</option>';
    
    let visibleCharacters = this.savedCharacters;
    if (this.currentUser && this.currentUser.role === 'player') {
      visibleCharacters = this.savedCharacters.filter(c => c.owner === this.currentUser.username);
    }
    
    visibleCharacters.forEach(c => {
      const option = document.createElement('option');
      option.value = c.name;
      option.textContent = c.name;
      if (c.name === currentVal) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  // DICE ROLLER DEDICATED TAB
  changeDieCount(sides, delta) {
    if (!this.diceCounts) {
      this.diceCounts = { 4: 1, 6: 1, 8: 1, 10: 1, 12: 1, 20: 1, 100: 1 };
    }
    const current = this.diceCounts[sides] || 1;
    const next = Math.max(1, Math.min(100, current + delta));
    this.diceCounts[sides] = next;
    const el = document.getElementById(`die-count-${sides}`);
    if (el) el.textContent = next;
  }

  rollDie(sides) {
    if (!this.diceCounts) {
      this.diceCounts = { 4: 1, 6: 1, 8: 1, 10: 1, 12: 1, 20: 1, 100: 1 };
    }
    const el = document.getElementById(`die-count-${sides}`);
    const qty = el ? (parseInt(el.textContent) || this.diceCounts[sides] || 1) : (this.diceCounts[sides] || 1);

    const rolls = [];
    for (let i = 0; i < qty; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const sum = rolls.reduce((a, b) => a + b, 0);
    const total = sum;
    
    // Visual Shake effect on the tray
    const diceTray = document.querySelector('.dice-grid');
    if (diceTray) {
      diceTray.classList.add('rolling');
      setTimeout(() => diceTray.classList.remove('rolling'), 300);
    }

    const logEl = document.getElementById('dice-roll-log');
    const charSelect = document.getElementById('dice-character-select');
    const rollerName = charSelect && charSelect.value ? charSelect.value : null;
    const prefix = rollerName ? `<strong>[${rollerName}]</strong> ` : '';

    if (logEl) {
      const date = new Date();
      const timeStr = date.toTimeString().split(' ')[0];
      
      const dieName = sides === 100 ? 'd%' : `d${sides}`;
      const formulaStr = `${qty}${dieName}`;
      const rollsDetails = qty > 1 ? ` (Dados: ${rolls.join(', ')})` : '';
      const logItem = `<div><span style="color:#d4af37">[${timeStr}]</span> ${prefix}Rolou <strong>${formulaStr}</strong>: <span class="roll-result" style="font-size:1.15rem; font-weight:bold; color:var(--accent-gold);">${total}</span>${rollsDetails}</div>`;
      
      if (logEl.innerHTML.includes('Nenhuma rolagem') || logEl.innerHTML.includes('Histórico limpo') || logEl.innerHTML.includes('Clique em um dado')) {
        logEl.innerHTML = logItem;
      } else {
        logEl.innerHTML = logItem + logEl.innerHTML;
      }
      
      logEl.scrollTop = 0;
    }
    const logFormula = `${qty}${sides === 100 ? 'd%' : 'd' + sides}`;
    const logDetails = qty > 1 ? ` (Dados: ${rolls.join(', ')})` : '';
    this.logAction(`Rolou ${logFormula} (Resultado: ${total}${logDetails})${rollerName ? ' para ' + rollerName : ''}`);
    return total;
  }

  rollFromSheet(label, modifier) {
    const isInit = label === 'Iniciativa';
    const sides = isInit ? 10 : 20;
    const roll = Math.floor(Math.random() * sides) + 1;
    const total = roll + modifier;

    // Toast feedback since player is looking at the character sheet
    const modSign = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    const formula = `1d${sides}${modifier !== 0 ? modSign : ''}`;
    const resultMsg = `<strong>${label}</strong><br>${formula} = <strong style="font-size:1.2rem; color:var(--accent-gold);">${total}</strong> <span style="font-size:0.85rem; color:var(--text-muted);">(Dado: ${roll})</span>`;
    this.showToast(resultMsg);

    // Also log to the Mesa de Dados tab log
    const logEl = document.getElementById('dice-roll-log');
    if (logEl) {
      const date = new Date();
      const timeStr = date.toTimeString().split(' ')[0];
      const logItem = `<div><span style="color:#d4af37">[${timeStr}]</span> <strong>${label}</strong>: ${formula} = <span class="roll-result" style="font-size:1.1rem; color:var(--accent-gold);">${total}</span> (Dado: ${roll})</div>`;
      
      if (logEl.innerHTML.includes('Nenhuma rolagem') || logEl.innerHTML.includes('Histórico limpo') || logEl.innerHTML.includes('Clique em um dado')) {
        logEl.innerHTML = logItem;
      } else {
        logEl.innerHTML = logItem + logEl.innerHTML;
      }
      logEl.scrollTop = 0;
    }
    this.logAction(`Rolou ${label}: ${formula} (Resultado: ${total})`);
    return total;
  }

  clearDiceLog() {
    const logEl = document.getElementById('dice-roll-log');
    if (logEl) {
      logEl.innerHTML = '<em>Histórico limpo. Clique nos dados para rolar!</em>';
    }
  }

  rollCustomDice() {
    const inputEl = document.getElementById('custom-roll-input');
    if (!inputEl) return;
    const formula = inputEl.value.trim().toLowerCase();
    if (!formula) return;

    const logEl = document.getElementById('dice-roll-log');
    const date = new Date();
    const timeStr = date.toTimeString().split(' ')[0];

    const match = formula.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/);
    if (!match) {
      if (logEl) {
        const errorItem = `<div><span style="color:#d4af37">[${timeStr}]</span> <span style="color:#ff6666">Fórmula inválida: "${formula}". Use o formato XdY+Z (ex: 2d6+3)</span></div>`;
        logEl.innerHTML = logEl.innerHTML.includes('Nenhuma rolagem') || logEl.innerHTML.includes('Histórico limpo') || logEl.innerHTML.includes('Clique em um dado') ? errorItem : errorItem + logEl.innerHTML;
      }
      return;
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const op = match[3] || null;
    const modValue = match[4] ? parseInt(match[4]) : 0;
    const mod = op === '-' ? -modValue : modValue;

    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      if (logEl) {
        const errorItem = `<div><span style="color:#d4af37">[${timeStr}]</span> <span style="color:#ff6666">Erro: quantidade de dados (1-100) ou lados (2-1000) fora dos limites.</span></div>`;
        logEl.innerHTML = logEl.innerHTML.includes('Nenhuma rolagem') || logEl.innerHTML.includes('Histórico limpo') || logEl.innerHTML.includes('Clique em um dado') ? errorItem : errorItem + logEl.innerHTML;
      }
      return;
    }

    let rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
      const r = Math.floor(Math.random() * sides) + 1;
      rolls.push(r);
      sum += r;
    }

    const total = sum + mod;
    const modSign = mod >= 0 ? `+${mod}` : `${mod}`;
    const formulaDisplay = `${count}d${sides}${mod !== 0 ? modSign : ''}`;
    const rollsDisplay = rolls.join(', ');

    const charSelect = document.getElementById('dice-character-select');
    const rollerName = charSelect && charSelect.value ? charSelect.value : null;
    const prefix = rollerName ? `<strong>[${rollerName}]</strong> ` : '';

    const logItem = `<div>
      <span style="color:#d4af37">[${timeStr}]</span> ${prefix}Rolo <strong>${formulaDisplay}</strong>: 
      <span class="roll-result" style="font-size:1.1rem; color:var(--accent-gold);">${total}</span> 
      (Dados: [${rollsDisplay}] ${mod !== 0 ? `Modificador: ${modSign}` : ''})
    </div>`;

    if (logEl) {
      if (logEl.innerHTML.includes('Nenhuma rolagem') || logEl.innerHTML.includes('Histórico limpo') || logEl.innerHTML.includes('Clique em um dado')) {
        logEl.innerHTML = logItem;
      } else {
        logEl.innerHTML = logItem + logEl.innerHTML;
      }
      logEl.scrollTop = 0;
    }
    this.logAction(`Rolou customizado ${formulaDisplay} (Resultado: ${total})${rollerName ? ' para ' + rollerName : ''}`);

    inputEl.value = '';
  }

  showToast(message, duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.style.cssText = 'background: rgba(22, 22, 28, 0.95); border: 1px solid var(--accent-gold); border-radius: var(--radius-md); padding: 12px 20px; color: var(--text-parchment); box-shadow: var(--shadow-premium); pointer-events: auto; animation: slideIn 0.3s ease-out; font-family: var(--font-body); display: flex; align-items: center; gap: 10px; min-width: 250px;';
    
    toast.innerHTML = `<span style="font-size:1.5rem;">🎲</span> <div>${message}</div>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => {
        toast.remove();
      }, 500);
    }, duration);
  }


  // CHARACTER CREATOR STEP RENDERING
  renderCreatorStep() {
    // Update step indicator
    for (let i = 1; i <= 5; i++) {
      const node = document.getElementById(`step-node-${i}`);
      node.className = "step-node";
      if (i === this.creatorStep) {
        node.classList.add("active");
      } else if (i < this.creatorStep) {
        node.classList.add("completed");
      }
    }

    // Toggle Prev button
    document.getElementById('creator-prev-btn').disabled = this.creatorStep === 1;
    
    // Update Next/Finish button text
    const nextBtn = document.getElementById('creator-next-btn');
    if (this.creatorStep === 5) {
      nextBtn.textContent = "Finalizar Ficha";
    } else {
      nextBtn.textContent = "Avançar";
    }

    const container = document.getElementById('creator-step-content');
    container.innerHTML = "";

    switch(this.creatorStep) {
      case 1:
        this.renderStep1(container);
        break;
      case 2:
        this.renderStep2(container);
        break;
      case 3:
        this.renderStep3(container);
        break;
      case 4:
        this.renderStep4(container);
        break;
      case 5:
        this.renderStep5(container);
        break;
    }
  }

  creatorPrevStep() {
    if (this.creatorStep > 1) {
      this.creatorStep--;
      this.renderCreatorStep();
    }
  }

  creatorNextStep() {
    if (this.creatorStep === 5) {
      this.saveCharacterSheet(null, true);
    } else {
      // Validation per step
      if (this.creatorStep === 1) {
        const nameInput = document.getElementById('creator-char-name');
        if (!nameInput.value.trim()) {
          alert('Por favor, dê um nome ao seu herói!');
          return;
        }
        this.newChar.name = nameInput.value.trim();
        this.newChar.gender = document.getElementById('creator-char-gender').value;
        this.newChar.race = document.getElementById('creator-char-race').value;
        this.newChar.class = document.getElementById('creator-char-class').value;
        this.newChar.alignment = document.getElementById('creator-char-alignment').value;
        
        // Reset skills and feats if race/class changes to avoid illegal state
        this.newChar.skillRanks = {};
        this.newChar.feats = [];
        
        // Initialize default starting gold based on class
        const goldMap = {
          barbarian: 100, rogue: 100, bard: 100, cleric: 100,
          druid: 50, fighter: 100, paladin: 100, ranger: 100,
          monk: 7, sorcerer: 75, wizard: 75
        };
        this.newChar.gold = goldMap[this.newChar.class] || 100;
        this.newChar.equippedWeapon = null;
        this.newChar.equippedArmor = null;
        this.newChar.equippedShield = null;
        this.newChar.inventory = [];
      } else if (this.creatorStep === 2) {
        if (this.newChar.rollMethod === 'pointbuy') {
          const pointsRemaining = this.getPointBuyRemaining();
          if (pointsRemaining < 0) {
            alert('Você gastou mais pontos do que o disponível!');
            return;
          } else if (pointsRemaining > 0) {
            if (!confirm(`Você ainda possui ${pointsRemaining} pontos não distribuídos. Deseja continuar?`)) {
              return;
            }
          }
        } else {
          // Método de rolagem
          if (!this.rolledScores || this.rolledScores.length === 0) {
            alert('Por favor, role os seus atributos primeiro!');
            return;
          }
          
          // Verificar se todos os 6 atributos usam um índice único (sem duplicatas)
          const selections = [
            this.newChar.abilitiesRollSelections.str,
            this.newChar.abilitiesRollSelections.dex,
            this.newChar.abilitiesRollSelections.con,
            this.newChar.abilitiesRollSelections.int,
            this.newChar.abilitiesRollSelections.wis,
            this.newChar.abilitiesRollSelections.cha
          ];
          
          const uniqueSelections = new Set(selections);
          if (uniqueSelections.size < 6) {
            alert('Você atribuiu o mesmo valor rolado a mais de um atributo! Cada valor rolado deve ser atribuído a um único atributo.');
            return;
          }

          // Copy rolled scores to abilitiesBase!
          for (let k in this.newChar.abilitiesRolls) {
            this.newChar.abilitiesBase[k] = this.newChar.abilitiesRolls[k];
          }
        }
      } else if (this.creatorStep === 3) {
        const remaining = this.getRemainingSkillPoints();
        if (remaining < 0) {
          alert('Você distribuiu mais pontos de perícia do que o permitido para seu nível e classe!');
          return;
        } else if (remaining > 0) {
          if (!confirm(`Você ainda tem ${remaining} pontos de perícia para gastar. Deseja continuar?`)) {
            return;
          }
        }
      } else if (this.creatorStep === 4) {
        const maxFeats = this.getMaxFeatsCount();
        if (this.newChar.feats.length < maxFeats) {
          if (!confirm(`Você pode escolher até ${maxFeats} talentos, mas selecionou apenas ${this.newChar.feats.length}. Avançar mesmo assim?`)) {
            return;
          }
        }
        
        // Validação de Talento de Combate para Guerreiro
        if (this.newChar.class === 'fighter') {
          const chosenFeats = this.newChar.feats;
          const hasFighterBonusFeat = chosenFeats.some(fKey => {
            const feat = window.DND3_Feats[fKey];
            return feat && feat.fighterBonus === true;
          });
          
          if (!hasFighterBonusFeat && chosenFeats.length > 0) {
            alert("Regra de Guerreiro: Como Guerreiro de 1º nível, você ganha um talento de combate bônus. Pelo menos um de seus talentos escolhidos deve ser um talento de combate válido (marcado com 'Talento de Combate').");
            return;
          }
        }
      }
      
      this.creatorStep++;
      this.renderCreatorStep();
    }
  }

  // STEP 1: RACE, CLASS, ALIGNMENT
  renderStep1(container) {
    let raceOptions = "";
    for (let r in window.DND3_Races) {
      const raceObj = window.DND3_Races[r];
      let modsText = [];
      for (let attr in raceObj.modifiers) {
        if (raceObj.modifiers[attr] !== 0) {
          modsText.push(`${attr.toUpperCase()}: ${raceObj.modifiers[attr] > 0 ? '+' + raceObj.modifiers[attr] : raceObj.modifiers[attr]}`);
        }
      }
      const modsStr = modsText.length > 0 ? ` (${modsText.join(', ')})` : '';
      raceOptions += `<option value="${r}" ${this.newChar.race === r ? 'selected' : ''}>${raceObj.name}${modsStr}</option>`;
    }

    let classOptions = `
      <optgroup label="Classes Básicas">
        ${Object.keys(window.DND3_Classes).filter(c => !['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(c)).map(c => `<option value="${c}" ${this.newChar.class === c ? 'selected' : ''}>${window.DND3_Classes[c].name}</option>`).join('')}
      </optgroup>
      <optgroup label="Classes de Prestígio">
        ${Object.keys(window.DND3_Classes).filter(c => ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(c)).map(c => `<option value="${c}" ${this.newChar.class === c ? 'selected' : ''}>${window.DND3_Classes[c].name}</option>`).join('')}
      </optgroup>
    `;

    let alignOptions = "";
    for (let a in window.DND3_Alignments) {
      alignOptions += `<option value="${a}" ${this.newChar.alignment === a ? 'selected' : ''}>${window.DND3_Alignments[a]}</option>`;
    }

    container.innerHTML = `
      <div class="grid-2">
        <div>
          <div class="rpg-form-group">
            <label class="rpg-label" for="creator-char-name">Nome do Personagem</label>
            <input type="text" id="creator-char-name" class="rpg-input" value="${this.newChar.name}" placeholder="Ex: Regdar, Jozan, Mialee...">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" for="creator-char-gender">Gênero</label>
            <select id="creator-char-gender" class="rpg-select">
              <option value="Masculino" ${this.newChar.gender === 'Masculino' ? 'selected' : ''}>Masculino</option>
              <option value="Feminino" ${this.newChar.gender === 'Feminino' ? 'selected' : ''}>Feminino</option>
              <option value="Outro" ${this.newChar.gender === 'Outro' ? 'selected' : ''}>Outro</option>
            </select>
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" for="creator-char-race">Raça</label>
            <select id="creator-char-race" class="rpg-select" onchange="app.updateRaceDetails(this.value)">
              ${raceOptions}
            </select>
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" for="creator-char-class">Classe Inicial</label>
            <select id="creator-char-class" class="rpg-select" onchange="app.updateClassDetails(this.value)">
              ${classOptions}
            </select>
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" for="creator-char-alignment">Alinhamento</label>
            <select id="creator-char-alignment" class="rpg-select">
              ${alignOptions}
            </select>
          </div>
        </div>
        
        <!-- Race / Class info preview card -->
        <div style="background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 1.5rem; border: var(--border-gold);">
          <h3 id="step1-preview-title" style="margin-bottom: 0.5rem; text-transform: uppercase;">Resumo da Escolha</h3>
          <div id="step1-preview-body" style="font-size: 0.9rem;">
            <!-- Rendered below -->
          </div>
        </div>
      </div>
    `;

    this.updateStep1Preview();
  }

  updateRaceDetails(val) {
    this.newChar.race = val;
    // Check alignments restrictions for specific classes
    this.validateAlignments();
    this.updateStep1Preview();
  }

  updateClassDetails(val) {
    this.newChar.class = val;
    if (this.newChar.classes && this.newChar.classes.length === 1) {
      this.newChar.classes[0].classKey = val;
    } else {
      this.newChar.classes = [ { classKey: val, level: this.newChar.level || 1 } ];
    }
    this.validateAlignments();
    this.updateStep1Preview();
  }

  validateAlignments() {
    const cls = this.newChar.class;
    const clData = window.DND3_Classes[cls];
    const alignSelect = document.getElementById('creator-char-alignment');
    if (!alignSelect) return;

    // Filter alignment options based on restrictions
    let alignOptions = "";
    for (let a in window.DND3_Alignments) {
      if (clData.alignments.includes(a)) {
        alignOptions += `<option value="${a}" ${this.newChar.alignment === a ? 'selected' : ''}>${window.DND3_Alignments[a]}</option>`;
      }
    }
    alignSelect.innerHTML = alignOptions;
    
    // If current selected is illegal, set to first legal
    if (!clData.alignments.includes(this.newChar.alignment)) {
      this.newChar.alignment = clData.alignments[0];
      alignSelect.value = this.newChar.alignment;
    }
  }

  updateStep1Preview() {
    const rc = window.DND3_Races[this.newChar.race];
    const cl = window.DND3_Classes[this.newChar.class];
    const previewBody = document.getElementById('step1-preview-body');
    
    if (!previewBody) return;

    let traitsHtml = rc.traits.map(t => `<li style="margin-bottom: 4px;">${t}</li>`).join('');
    
    // Features for level 1
    let featuresHtml = cl.features[1] && cl.features[1].length > 0
      ? cl.features[1].map(f => `<li style="margin-bottom: 4px;"><strong>${f}</strong></li>`).join('')
      : "<li>Nenhuma habilidade especial no nível 1.</li>";

    previewBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="color: var(--accent-gold); font-size: 1.1rem; border-bottom: 1px dashed rgba(212,175,55,0.3); padding-bottom: 2px; margin-bottom: 6px;">Traços de Raça: ${rc.name}</h4>
        <p style="font-style: italic; color: var(--text-muted); margin-bottom: 8px;">${rc.description}</p>
        <p><strong>Modificadores de Atributo:</strong> ${this.formatModifiers(rc.modifiers)}</p>
        <p><strong>Deslocamento:</strong> ${rc.speed} ft (mão/pés)</p>
        <ul style="margin-left: 1.2rem; margin-top: 8px;">${traitsHtml}</ul>
      </div>

      <div>
        <h4 style="color: var(--accent-gold); font-size: 1.1rem; border-bottom: 1px dashed rgba(212,175,55,0.3); padding-bottom: 2px; margin-bottom: 6px;">Características de Classe: ${cl.name}</h4>
        <p><strong>Dado de Vida:</strong> d${cl.hd}</p>
        <p><strong>Pontos de Perícia:</strong> (${cl.skillPoints} + Mod. Int) x 4 no nível 1</p>
        <p><strong>Habilidades de Nível 1:</strong></p>
        <ul style="margin-left: 1.2rem; margin-top: 4px;">${featuresHtml}</ul>
      </div>
    `;
  }

  formatModifiers(mods) {
    let parts = [];
    for (let k in mods) {
      if (mods[k] !== 0) {
        parts.push(`${k.toUpperCase()} ${mods[k] > 0 ? '+' + mods[k] : mods[k]}`);
      }
    }
    return parts.length > 0 ? parts.join(', ') : "Nenhum";
  }

  // STEP 2: ABILITY SCORES
  renderStep2(container) {
    container.innerHTML = `
      <div class="rpg-form-group" style="margin-bottom: 1.5rem; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: var(--border-gold);">
        <label class="rpg-label">Método de Atribuição de Habilidades</label>
        <div style="display: flex; gap: 20px; margin-top: 5px;">
          <label style="cursor: pointer;"><input type="radio" name="roll_method" value="pointbuy" ${this.newChar.rollMethod === 'pointbuy' ? 'checked' : ''} onchange="app.setRollMethod('pointbuy')"> Compra de Pontos (25 pts - Padrão)</label>
          <label style="cursor: pointer;"><input type="radio" name="roll_method" value="roll" ${this.newChar.rollMethod === 'roll' ? 'checked' : ''} onchange="app.setRollMethod('roll')"> Rolar Atributos (4d6 drop-lowest)</label>
        </div>
      </div>
      
      <div class="grid-2">
        <div id="abilities-inputs-container">
          <!-- Populated by renderAbilitiesInputs -->
        </div>

        <div style="background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 1.5rem; border: var(--border-gold); height: fit-content;">
          <h3 style="margin-bottom: 0.8rem; text-transform: uppercase;">Modificadores & Raça</h3>
          <div id="ability-preview-summary" style="font-size: 0.95rem;">
            <!-- Ability totals and mods preview -->
          </div>
          <div id="roll-method-help" style="margin-top: 1.5rem; border-top: 1px solid rgba(212,175,55,0.2); padding-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
            <!-- Help text or rolling button -->
          </div>
        </div>
      </div>
    `;

    this.renderAbilitiesInputs();
  }

  setRollMethod(method) {
    this.newChar.rollMethod = method;
    this.renderAbilitiesInputs();
  }

  getPointBuyCost(score) {
    const costs = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16 };
    return costs[score] || 0;
  }

  getPointBuyRemaining() {
    let spent = 0;
    for (let k in this.newChar.abilitiesBase) {
      spent += this.getPointBuyCost(this.newChar.abilitiesBase[k]);
    }
    return 25 - spent;
  }

  adjustAbilityPointBuy(ability, delta) {
    let cur = this.newChar.abilitiesBase[ability];
    let next = cur + delta;
    if (next < 8 || next > 18) return;
    
    // Check points
    const oldCost = this.getPointBuyCost(cur);
    const newCost = this.getPointBuyCost(next);
    const costDiff = newCost - oldCost;
    const remaining = this.getPointBuyRemaining();

    if (costDiff > remaining) {
      alert("Pontos de compra insuficientes!");
      return;
    }

    this.newChar.abilitiesBase[ability] = next;
    this.renderAbilitiesInputs();
  }

  rollAbilities() {
    const stats = ["str", "dex", "con", "int", "wis", "cha"];
    let rolled = [];
    let isViable = false;
    let attempts = 0;
    let discardedSets = [];

    while (!isViable && attempts < 100) {
      attempts++;
      rolled = [];
      let modsSum = 0;
      let maxVal = 0;

      for (let i = 0; i < 6; i++) {
        let dice = [];
        for (let j = 0; j < 4; j++) dice.push(Math.floor(Math.random() * 6) + 1);
        dice.sort();
        let val = dice[1] + dice[2] + dice[3];
        rolled.push(val);
        
        let mod = Math.floor((val - 10) / 2);
        modsSum += mod;
        if (val > maxVal) maxVal = val;
      }

      // PHB page 4 rule: soma dos mods <= 0 ou maior atributo <= 13 é inviável
      if (modsSum > 0 && maxVal >= 14) {
        isViable = true;
      } else {
        discardedSets.push(`[${rolled.join(', ')}] (Soma dos Mods: ${modsSum}, Máximo: ${maxVal})`);
      }
    }

    if (attempts > 1) {
      let discardText = discardedSets.map((s, idx) => `Conjunto #${idx+1}: ${s}`).join('\n');
      alert(`Regra de Inviabilidade de Atributos do PHB ativada!\nForam descartados ${attempts - 1} conjuntos de atributos por serem muito fracos:\n${discardText}\n\nConjunto aceito após ${attempts} tentativas!`);
    }

    this.rolledScores = rolled;
    this.newChar.abilitiesRollSelections = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 };
    
    // Atualizar os valores finais dos rolos na ordem inicial
    stats.forEach((s, idx) => {
      this.newChar.abilitiesRolls[s] = this.rolledScores[idx];
    });

    this.renderAbilitiesInputs();
  }

  setAbilityRollSelection(ability, indexStr) {
    const idx = parseInt(indexStr);
    this.newChar.abilitiesRollSelections[ability] = idx;
    
    if (this.rolledScores && this.rolledScores[idx] !== undefined) {
      this.newChar.abilitiesRolls[ability] = this.rolledScores[idx];
    }
    
    this.renderAbilitiesInputs();
  }

  renderAbilitiesInputs() {
    const isPointBuy = this.newChar.rollMethod === 'pointbuy';
    const container = document.getElementById('abilities-inputs-container');
    const preview = document.getElementById('ability-preview-summary');
    const help = document.getElementById('roll-method-help');
    
    if (!container || !preview) return;

    const stats = {
      str: "Força (Strength)",
      dex: "Destreza (Dexterity)",
      con: "Constituição (Constitution)",
      int: "Inteligência (Intelligence)",
      wis: "Sabedoria (Wisdom)",
      cha: "Carisma (Charisma)"
    };

    let html = "";
    
    if (isPointBuy) {
      const remaining = this.getPointBuyRemaining();
      html += `<div style="font-size: 1.1rem; font-family: var(--font-header); color: var(--accent-gold); margin-bottom: 1rem;">Pontos de Compra Disponíveis: <span style="font-size: 1.5rem; font-weight: bold;">${remaining} / 25</span></div>`;
      
      for (let k in stats) {
        let val = this.newChar.abilitiesBase[k];
        let cost = this.getPointBuyCost(val);
        html += `
          <div class="stat-buy-row">
            <div><strong>${stats[k].split(' ')[0]}</strong></div>
            <div class="stat-buy-controls">
              <button class="buy-btn" onclick="app.adjustAbilityPointBuy('${k}', -1)" ${val <= 8 ? 'disabled' : ''}>-</button>
              <div class="stat-val-display">${val}</div>
              <button class="buy-btn" onclick="app.adjustAbilityPointBuy('${k}', 1)" ${val >= 18 || this.getPointBuyCost(val+1) - cost > remaining ? 'disabled' : ''}>+</button>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted);">Custo: ${cost} pts</div>
          </div>
        `;
      }

      help.innerHTML = `
        <p><strong>Regra de Compra de Pontos (3.0/3.5)</strong>:</p>
        <p>Todos os atributos começam em 8. O custo aumenta conforme o valor:</p>
        <p>8-14: 1 ponto por nível de atributo.</p>
        <p>15-16: 2 pontos por nível (15 custa 8, 16 custa 10).</p>
        <p>17-18: 3 pontos por nível (17 custa 13, 18 custa 16).</p>
      `;
    } else {
      if (!this.rolledScores || this.rolledScores.length === 0) {
        html += `
          <div style="text-align: center; padding: 2rem 1rem;">
            <p style="margin-bottom: 1.5rem; color: var(--text-muted);">Você ainda não rolou seus atributos para este personagem.</p>
            <button class="rpg-btn" style="width: 100%; max-width: 250px;" onclick="app.rollAbilities()">Rolar 6 Atributos (4d6)</button>
          </div>
        `;
        help.innerHTML = `
          <p><strong>Método de Rolagem Oficial (PHB)</strong>:</p>
          <p>Role 4 dados de 6 lados (4d6) e descarte o menor valor para cada atributo.</p>
          <p><strong>Regra de Inviabilidade</strong>: Se a soma dos modificadores for 0 ou menos, ou se o maior atributo for 13 ou menos, o conjunto é inviável e será rolado novamente.</p>
        `;
      } else {
        html += `<div style="font-size: 1.1rem; font-family: var(--font-header); color: var(--accent-gold); margin-bottom: 1rem;">Distribua os Valores Rolados</div>`;
        html += `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; background: rgba(212,175,55,0.05); padding: 8px; border-radius: 4px; border-left: 3px solid var(--accent-gold);">
          Valores obtidos: <strong>${this.rolledScores.join(', ')}</strong><br>
          Atribua cada valor a um atributo diferente. Nenhuma duplicata é permitida.
        </div>`;
        
        for (let k in stats) {
          let selectedIdx = this.newChar.abilitiesRollSelections[k];
          
          let optionsHtml = "";
          this.rolledScores.forEach((val, idx) => {
            optionsHtml += `<option value="${idx}" ${selectedIdx === idx ? 'selected' : ''}>Valor: ${val} (Rolagem #${idx+1})</option>`;
          });

          html += `
            <div class="stat-buy-row" style="align-items: center; padding: 4px 0;">
              <div style="width:120px;"><strong>${stats[k].split(' ')[0]}</strong></div>
              <select class="rpg-select" style="width: 180px; margin: 0; padding: 4px;" onchange="app.setAbilityRollSelection('${k}', this.value)">
                ${optionsHtml}
              </select>
            </div>
          `;
        }

        help.innerHTML = `
          <p>Para rolar novos atributos (isso substituirá a rolagem atual):</p>
          <button class="rpg-btn" style="margin-top: 10px; width: 100%;" onclick="app.rollAbilities()">Re-rolar Atributos</button>
        `;
      }
    }

    container.innerHTML = html;

    // Calculate final scores including race
    const rc = window.DND3_Races[this.newChar.race];
    let previewHtml = `<table class="rpg-table" style="margin-top:0;">
      <thead>
        <tr>
          <th>Atributo</th>
          <th>Base</th>
          <th>Raça</th>
          <th>Final</th>
          <th>Modif.</th>
        </tr>
      </thead>
      <tbody>`;

    for (let k in stats) {
      let baseVal = isPointBuy ? this.newChar.abilitiesBase[k] : this.newChar.abilitiesRolls[k];
      let raceMod = rc.modifiers[k] || 0;
      let finalVal = baseVal + raceMod;
      let mod = Math.floor((finalVal - 10) / 2);
      let sign = mod >= 0 ? `+${mod}` : `${mod}`;

      previewHtml += `
        <tr>
          <td><strong>${k.toUpperCase()}</strong></td>
          <td>${baseVal}</td>
          <td>${raceMod >= 0 ? '+' + raceMod : raceMod}</td>
          <td style="color:var(--accent-gold); font-weight:bold;">${finalVal}</td>
          <td><span class="condition-tag ${mod >= 0 ? 'condition-tag-bonus' : ''}" style="margin:0;">${sign}</span></td>
        </tr>
      `;
    }
    previewHtml += `</tbody></table>`;
    preview.innerHTML = previewHtml;
  }

  // Get active ability score (with racial bonus)
  getCharAbility(abilityName) {
    const isPointBuy = this.newChar.rollMethod === 'pointbuy';
    const base = isPointBuy ? this.newChar.abilitiesBase[abilityName] : this.newChar.abilitiesRolls[abilityName];
    const rc = window.DND3_Races[this.newChar.race];
    return base + (rc.modifiers[abilityName] || 0);
  }

  getCharAbilityMod(abilityName) {
    const score = this.getCharAbility(abilityName);
    return Math.floor((score - 10) / 2);
  }

  // STEP 3: SKILLS
  getMaxSkillRanks() {
    // 3.0 Rules: Max class skill rank = level + 3. Max cross-class rank = (level + 3)/2.
    return {
      classSkill: this.newChar.level + 3, // 4 at lvl 1
      crossClass: (this.newChar.level + 3) / 2 // 2 at lvl 1
    };
  }

  getMaxSkillPoints() {
    const cl = window.DND3_Classes[this.newChar.class];
    const intMod = this.getCharAbilityMod('int');
    let points = cl.skillPoints + intMod;
    if (points < 1) points = 1; // minimum 1 point per level
    
    // Human gets 4 extra at level 1, +1 thereafter
    const isHuman = this.newChar.race === 'human';
    if (this.newChar.level === 1) {
      points = points * 4;
      if (isHuman) points += 4;
    } else {
      // For level 1 creator, this is fine
    }
    return points;
  }

  getSpentSkillPoints() {
    const cl = window.DND3_Classes[this.newChar.class];
    let spent = 0;
    for (let k in this.newChar.skillRanks) {
      let ranks = this.newChar.skillRanks[k] || 0;
      let isClass = cl.classSkills.includes(k);
      spent += isClass ? ranks : ranks * 2; // cross-class costs 2 pts per rank
    }
    return spent;
  }

  getRemainingSkillPoints() {
    return this.getMaxSkillPoints() - this.getSpentSkillPoints();
  }

  adjustSkillRank(skillKey, delta) {
    const cl = window.DND3_Classes[this.newChar.class];
    const isClass = cl.classSkills.includes(skillKey);
    const limits = this.getMaxSkillRanks();
    const maxRank = isClass ? limits.classSkill : limits.crossClass;
    
    let curRanks = this.newChar.skillRanks[skillKey] || 0;
    let nextRanks = curRanks + delta;
    
    if (nextRanks < 0 || nextRanks > maxRank) return;

    // Calcular temporariamente se a mudança estoura os pontos
    const oldRanks = this.newChar.skillRanks[skillKey] || 0;
    this.newChar.skillRanks[skillKey] = nextRanks;
    const remaining = this.getRemainingSkillPoints();

    if (remaining < 0) {
      this.newChar.skillRanks[skillKey] = oldRanks;
      alert("Pontos de perícia insuficientes!");
      return;
    }

    this.renderStep3List();
  }

  renderStep3(container) {
    const maxPts = this.getMaxSkillPoints();
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:rgba(0,0,0,0.3); border:var(--border-gold); padding:12px; border-radius:6px;">
        <div>
          <span class="rpg-label" style="margin:0;">Pontos de Perícia para Gastar:</span>
          <span style="font-size:1.4rem; font-family:var(--font-header); font-weight:bold; color:var(--accent-gold);" id="skill-points-counter">${maxPts} / ${maxPts}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right;">
          Max Graduações: Classe = <strong>${this.newChar.level + 3}</strong> | Classe Cruzada = <strong>${(this.newChar.level + 3) / 2}</strong>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <input type="text" id="creator-skill-search-input" class="rpg-input" placeholder="Pesquisar perícias..." oninput="app.filterCreatorSkillOptions()" style="width: 100%; height:32px; background:rgba(0,0,0,0.3); border-color:var(--accent-gold-dark); color:var(--text-parchment);">
      </div>

      <div id="skills-allocator-container" style="max-height: 450px; overflow-y: auto; border: var(--border-gold); border-radius: 6px; padding: 10px; background: rgba(0,0,0,0.2);">
        <!-- Filled by renderStep3List -->
      </div>
    `;
    this.renderStep3List();
  }

  filterCreatorSkillOptions() {
    this.renderStep3List();
  }

  renderStep3List() {
    const cl = window.DND3_Classes[this.newChar.class];
    const limits = this.getMaxSkillRanks();
    const counter = document.getElementById('skill-points-counter');
    const container = document.getElementById('skills-allocator-container');
    
    if (counter) {
      counter.textContent = `${this.getRemainingSkillPoints()} / ${this.getMaxSkillPoints()}`;
    }

    if (!container) return;

    const searchInput = document.getElementById('creator-skill-search-input');
    const q = searchInput ? searchInput.value.toLowerCase() : '';

    let html = "";
    
    // Sort skills alphabetically
    let keys = Object.keys(window.DND3_Skills).sort((a,b) => window.DND3_Skills[a].name.localeCompare(window.DND3_Skills[b].name));
    
    keys.forEach(k => {
      const sk = window.DND3_Skills[k];
      if (q && !sk.name.toLowerCase().includes(q) && !sk.desc.toLowerCase().includes(q)) {
        return;
      }

      const isClass = cl.classSkills.includes(k);
      const ranks = this.newChar.skillRanks[k] || 0;
      const abilityMod = this.getCharAbilityMod(sk.keyAbility);
      const max = isClass ? limits.classSkill : limits.crossClass;
      const delta = isClass ? 1.0 : 0.5;
      
      // Calculate total modifier display
      const total = ranks + abilityMod;
      const totalSign = total >= 0 ? `+${total}` : `${total}`;

      html += `
        <div class="skill-allocator-row" style="${isClass ? 'border-left: 3px solid var(--accent-gold);' : 'border-left: 3px solid rgba(255,255,255,0.1);'}">
          <div class="skill-allocator-info">
            <span style="font-weight:bold;">${sk.name}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px;">(${sk.keyAbility.toUpperCase()})</span>
            ${isClass ? '<span class="class-skill-badge">Classe</span>' : '<span class="class-skill-badge" style="background:rgba(255,255,255,0.05); color:var(--text-muted); border-color:rgba(255,255,255,0.1)">Classe Cruzada</span>'}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${sk.desc}</div>
          </div>
          
          <div class="skill-allocator-controls">
            <div style="font-size:0.85rem; color:var(--text-muted);">
              Graduação: <strong style="color:var(--text-light); font-size:1.1rem;">${ranks}</strong> / ${max}
            </div>
            
            <div class="stat-buy-controls">
              <button class="buy-btn" onclick="app.adjustSkillRank('${k}', -${delta})" ${ranks <= 0 ? 'disabled' : ''}>-</button>
              <button class="buy-btn" onclick="app.adjustSkillRank('${k}', ${delta})" ${ranks >= max ? 'disabled' : ''}>+</button>
            </div>
            
            <div style="width: 50px; text-align: center;">
              Mod: <strong style="color:var(--accent-gold);">${totalSign}</strong>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // STEP 4: FEATS
  getMaxFeatsCount() {
    let count = 1; // 1st level character gets 1 feat standard
    if (this.newChar.race === 'human') count += 1; // humans get 1 bonus feat at lvl 1
    if (this.newChar.class === 'fighter') count += 1; // fighter gets 1 bonus feat at lvl 1
    if (this.newChar.class === 'wizard') count += 1; // wizard gets Scribe Scroll at lvl 1
    return count;
  }

  checkFeatPrereqs(featKey) {
    const feat = window.DND3_Feats[featKey];
    if (!feat) return false;
    const prereqs = feat.prereqs;

    // Check ability prerequisites
    if (prereqs.str && this.getCharAbility('str') < prereqs.str) return false;
    if (prereqs.dex && this.getCharAbility('dex') < prereqs.dex) return false;
    if (prereqs.con && this.getCharAbility('con') < prereqs.con) return false;
    if (prereqs.int && this.getCharAbility('int') < prereqs.int) return false;
    if (prereqs.wis && this.getCharAbility('wis') < prereqs.wis) return false;
    if (prereqs.cha && this.getCharAbility('cha') < prereqs.cha) return false;

    // Check BAB prerequisite
    let bab = 0;
    const cl = window.DND3_Classes[this.newChar.class];
    if (cl.babProgression === 'good') bab = this.newChar.level;
    else if (cl.babProgression === 'medium') bab = Math.floor(this.newChar.level * 0.75);
    else bab = Math.floor(this.newChar.level * 0.5);

    if (prereqs.bab && bab < prereqs.bab) return false;

    // Check Class prerequisite
    if (prereqs.class && this.newChar.class !== prereqs.class) return false;
    if (prereqs.level && this.newChar.level < prereqs.level) return false;

    // Check Feat dependencies
    if (prereqs.feats) {
      for (let f of prereqs.feats) {
        if (!this.newChar.feats.includes(f)) return false;
      }
    }

    return true;
  }

  toggleFeat(featKey) {
    const max = this.getMaxFeatsCount();
    const idx = this.newChar.feats.indexOf(featKey);

    if (idx >= 0) {
      // Remove feat and verify if other selected feats depend on it
      this.newChar.feats.splice(idx, 1);
      
      // Cascade check for dependencies
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = this.newChar.feats.length - 1; i >= 0; i--) {
          let fk = this.newChar.feats[i];
          if (!this.checkFeatPrereqs(fk)) {
            this.newChar.feats.splice(i, 1);
            changed = true;
          }
        }
      }
    } else {
      if (this.newChar.feats.length >= max) {
        alert(`Você já atingiu o limite de ${max} talento(s) para seu nível, classe e raça!`);
        return;
      }

      if (!this.checkFeatPrereqs(featKey)) {
        alert("Você não atende aos pré-requisitos para este talento!");
        return;
      }

      this.newChar.feats.push(featKey);
    }

    this.renderStep4List();
  }

  renderStep4(container) {
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:rgba(0,0,0,0.3); border:var(--border-gold); padding:12px; border-radius:6px;">
        <div>
          <span class="rpg-label" style="margin:0;">Talentos Disponíveis:</span>
          <span style="font-size:1.4rem; font-family:var(--font-header); font-weight:bold; color:var(--accent-gold);" id="feats-points-counter">0 / 0</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); text-align:right;">
          Humano: <strong>+1 Talento</strong> | Guerreiro Nv 1: <strong>+1 Talento Militar</strong>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <input type="text" id="creator-feat-search-input" class="rpg-input" placeholder="Pesquisar talentos..." oninput="app.filterCreatorFeatOptions()" style="width: 100%; height:32px; background:rgba(0,0,0,0.3); border-color:var(--accent-gold-dark); color:var(--text-parchment);">
      </div>

      <div id="feats-allocator-container" style="max-height: 450px; overflow-y: auto; border: var(--border-gold); border-radius: 6px; padding: 10px; background: rgba(0,0,0,0.2);">
        <!-- Filled by renderStep4List -->
      </div>
    `;
    this.renderStep4List();
  }

  filterCreatorFeatOptions() {
    this.renderStep4List();
  }

  renderStep4List() {
    const max = this.getMaxFeatsCount();
    const count = this.newChar.feats.length;
    const counter = document.getElementById('feats-points-counter');
    const container = document.getElementById('feats-allocator-container');

    if (counter) {
      counter.textContent = `${count} / ${max}`;
    }

    if (!container) return;

    const searchInput = document.getElementById('creator-feat-search-input');
    const q = searchInput ? searchInput.value.toLowerCase() : '';

    let html = "";
    
    // Special wizard auto feat: Scribe scroll
    if (this.newChar.class === 'wizard' && !this.newChar.feats.includes('scribe_scroll')) {
      this.newChar.feats.push('scribe_scroll');
    }

    for (let k in window.DND3_Feats) {
      const feat = window.DND3_Feats[k];
      if (q && !feat.name.toLowerCase().includes(q) && !feat.benefit.toLowerCase().includes(q)) {
        continue;
      }
      const isSelected = this.newChar.feats.includes(k);
      const isWizardScroll = k === 'scribe_scroll' && this.newChar.class === 'wizard';
      
      let prereqsText = "";
      let hasPrereq = this.checkFeatPrereqs(k);
      
      // Build prerequisite display
      let prereqParts = [];
      if (feat.prereqs.str) prereqParts.push(`FOR ${feat.prereqs.str}`);
      if (feat.prereqs.dex) prereqParts.push(`DES ${feat.prereqs.dex}`);
      if (feat.prereqs.bab) prereqParts.push(`BBA +${feat.prereqs.bab}`);
      if (feat.prereqs.class) prereqParts.push(`Classe: ${window.DND3_Classes[feat.prereqs.class].name}`);
      if (feat.prereqs.feats) {
        feat.prereqs.feats.forEach(fKey => prereqParts.push(`Talento: ${window.DND3_Feats[fKey].name}`));
      }
      prereqsText = prereqParts.length > 0 ? prereqParts.join(', ') : "Nenhum";

      let fighterBadge = feat.fighterBonus ? `<span class="class-skill-badge" style="background: rgba(139, 0, 0, 0.2); color: #ff6666; border-color: #8b0000; margin-left: 8px;">Talento de Combate</span>` : '';

      html += `
        <div class="skill-allocator-row" style="${isSelected ? 'border-left: 3px solid var(--accent-gold); background:rgba(212,175,55,0.05);' : 'border-left: 3px solid rgba(255,255,255,0.05);'}">
          <div class="skill-allocator-info">
            <span style="font-weight:bold; font-family:var(--font-header); font-size:1.05rem; color:${isSelected ? 'var(--accent-gold)' : 'var(--text-parchment)'};">${feat.name} ${fighterBadge}</span>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${feat.benefit}</div>
            <div style="font-size:0.7rem; color:var(--accent-gold-dark); margin-top:3px;">Pré-requisitos: <strong>${prereqsText}</strong></div>
          </div>
          
          <div>
            ${isWizardScroll 
              ? '<span class="condition-tag condition-tag-bonus">Automático</span>'
              : `<button class="rpg-btn ${isSelected ? 'rpg-btn-secondary' : ''}" style="padding: 0.4rem 0.8rem; font-size:0.75rem;" onclick="app.toggleFeat('${k}')" ${!hasPrereq && !isSelected ? 'disabled' : ''}>${isSelected ? 'Remover' : 'Escolher'}</button>`
            }
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // STEP 5: EQUIPMENT & DETAILS
  renderStep5(container) {
    container.innerHTML = `
      <div class="grid-1-3">
        <!-- Purchase Menu / Gear Selector -->
        <div>
          <div class="rpg-card" style="margin-bottom:1.5rem; background:rgba(0,0,0,0.4);">
            <h3 style="font-size:1rem; margin-bottom:10px;">Fundos Iniciais</h3>
            <div style="font-size:1.8rem; font-weight:bold; color:var(--accent-gold); font-family:var(--font-header); display: flex; align-items: center; justify-content: space-between;">
              <div><span id="creator-gold-val">${this.newChar.gold}</span> PO</div>
              <button class="rpg-btn" style="padding: 4px 8px; font-size: 0.75rem;" onclick="app.rollStartingGold()">Rolar Ouro</button>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:5px;" id="gold-method-desc">Método: Padrão Médio da Classe.</p>
          </div>

          <div class="rpg-form-group">
            <label class="rpg-label">Categoria de Equipamento</label>
            <select id="creator-gear-cat" class="rpg-select" onchange="app.renderStep5GearList(this.value)">
              <option value="weapons">Armas (Weapons)</option>
              <option value="armor">Armaduras (Armor)</option>
              <option value="shields">Escudos (Shields)</option>
            </select>
          </div>

          <div id="creator-gear-shop" style="max-height:300px; overflow-y:auto; border:var(--border-gold); padding:5px; border-radius:4px; background:rgba(0,0,0,0.3);">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Inventory and Stats Preview -->
        <div>
          <div class="grid-2">
            <!-- Equipped panel -->
            <div class="rpg-card" style="background:rgba(0,0,0,0.2);">
              <h3 style="font-size:1.1rem; margin-bottom:1rem; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px;">Equipamento Ativo</h3>
              
              <div style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;">
                <div>
                  <span class="detail-label">Arma Empunhada:</span>
                  <div id="eq-weapon-name" style="font-weight:bold; color:var(--accent-gold);">Nenhuma</div>
                </div>
                <div>
                  <span class="detail-label">Armadura Vestida:</span>
                  <div id="eq-armor-name" style="font-weight:bold; color:var(--accent-gold);">Nenhuma</div>
                </div>
                <div>
                  <span class="detail-label">Escudo Equipado:</span>
                  <div id="eq-shield-name" style="font-weight:bold; color:var(--accent-gold);">Nenhum</div>
                </div>
              </div>

              <h4 style="font-size:0.95rem; margin-top:1.5rem; margin-bottom:5px;">Inventário de Itens</h4>
              <div id="creator-inventory-list" style="font-size:0.85rem; max-height:150px; overflow-y:auto;">
                <!-- List of items with Sell/Remove button -->
              </div>
            </div>

            <!-- Stats Preview -->
            <div class="rpg-card" style="background:rgba(0,0,0,0.2);">
              <h3 style="font-size:1.1rem; margin-bottom:1rem; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px;">Estatísticas Finais</h3>
              
              <div id="creator-stats-preview" style="font-size:0.9rem; display:flex; flex-direction:column; gap:8px;">
                <!-- Populated dynamically -->
              </div>
            </div>
          </div>

          <div class="rpg-form-group" style="margin-top: 1.5rem;">
            <label class="rpg-label" for="creator-notes">Histórico & Notas do Personagem</label>
            <textarea id="creator-notes" class="rpg-textarea" rows="3" placeholder="Insira o histórico, descrição física, traços de personalidade ou divindade padroeira do personagem..." oninput="app.newChar.notes = this.value"></textarea>
          </div>
        </div>
      </div>
    `;

    this.renderStep5GearList('weapons');
    this.updateCreatorInventory();
    this.updateCreatorStats();
  }

  renderStep5GearList(category) {
    const shop = document.getElementById('creator-gear-shop');
    if (!shop) return;

    let html = "";
    
    if (category === 'weapons') {
      window.DND3_Equipment.weapons.forEach(w => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
            <div>
              <strong>${w.name}</strong> <span style="color:var(--text-muted);">(${w.size})</span>
              <div style="font-size:0.75rem; color:var(--text-muted);">${w.damage} crit ${w.critical} - ${w.weight} kg</div>
            </div>
            <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.creatorBuyItem('weapons', '${w.id}')">${w.cost} PO</button>
          </div>
        `;
      });
    } else if (category === 'armor') {
      window.DND3_Equipment.armor.forEach(a => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
            <div>
              <strong>${a.name}</strong> <span style="color:var(--text-muted);">(${a.type})</span>
              <div style="font-size:0.75rem; color:var(--text-muted);">CA +${a.acBonus} | Max Des +${a.maxDex} | Pen ${a.penalty}</div>
            </div>
            <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.creatorBuyItem('armor', '${a.id}')">${a.cost} PO</button>
          </div>
        `;
      });
    } else if (category === 'shields') {
      window.DND3_Equipment.shields.forEach(s => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
            <div>
              <strong>${s.name}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">CA +${s.acBonus} | Penalidade ${s.penalty}</div>
            </div>
            <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.creatorBuyItem('shields', '${s.id}')">${s.cost} PO</button>
          </div>
        `;
      });
    }

    shop.innerHTML = html;
  }

  creatorBuyItem(category, itemId) {
    let itemData = null;
    if (category === 'weapons') {
      itemData = window.DND3_Equipment.weapons.find(w => w.id === itemId);
    } else if (category === 'armor') {
      itemData = window.DND3_Equipment.armor.find(a => a.id === itemId);
    } else if (category === 'shields') {
      itemData = window.DND3_Equipment.shields.find(s => s.id === itemId);
    }

    if (!itemData) return;

    if (this.newChar.gold < itemData.cost) {
      alert("PO insuficiente!");
      return;
    }

    this.newChar.gold -= itemData.cost;
    document.getElementById('creator-gold-val').textContent = this.newChar.gold;

    // Add to inventory and auto-equip if slot empty
    if (category === 'weapons' && !this.newChar.equippedWeapon) {
      this.newChar.equippedWeapon = itemData;
    } else if (category === 'armor' && !this.newChar.equippedArmor) {
      this.newChar.equippedArmor = itemData;
    } else if (category === 'shields' && !this.newChar.equippedShield) {
      this.newChar.equippedShield = itemData;
    }

    // Add record to overall inventory
    this.newChar.inventory.push({
      id: itemData.id,
      name: itemData.name,
      cost: itemData.cost,
      weight: itemData.weight,
      category: category,
      data: itemData
    });

    this.updateCreatorInventory();
    this.updateCreatorStats();
  }

  creatorSellItem(index) {
    const item = this.newChar.inventory[index];
    if (!item) return;

    // Refund
    this.newChar.gold += item.cost;
    document.getElementById('creator-gold-val').textContent = this.newChar.gold;

    // Remove from equipment slots if equipped
    if (this.newChar.equippedWeapon && this.newChar.equippedWeapon.id === item.id) {
      this.newChar.equippedWeapon = null;
    }
    if (this.newChar.equippedArmor && this.newChar.equippedArmor.id === item.id) {
      this.newChar.equippedArmor = null;
    }
    if (this.newChar.equippedShield && this.newChar.equippedShield.id === item.id) {
      this.newChar.equippedShield = null;
    }

    this.newChar.inventory.splice(index, 1);
    this.updateCreatorInventory();
    this.updateCreatorStats();
  }

  updateCreatorInventory() {
    const wEl = document.getElementById('eq-weapon-name');
    const aEl = document.getElementById('eq-armor-name');
    const sEl = document.getElementById('eq-shield-name');
    const invEl = document.getElementById('creator-inventory-list');

    if (wEl) wEl.textContent = this.newChar.equippedWeapon ? this.newChar.equippedWeapon.name : "Nenhuma";
    if (aEl) aEl.textContent = this.newChar.equippedArmor ? this.newChar.equippedArmor.name : "Nenhuma";
    if (sEl) sEl.textContent = this.newChar.equippedShield ? this.newChar.equippedShield.name : "Nenhum";

    if (!invEl) return;

    if (this.newChar.inventory.length === 0) {
      invEl.innerHTML = `<em style="color:var(--text-muted);">Sacola vazia.</em>`;
      return;
    }

    invEl.innerHTML = this.newChar.inventory.map((item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:2px 5px; background:rgba(255,255,255,0.02); border-radius:2px;">
        <span>${item.name} (${item.weight} kg)</span>
        <button class="tracker-remove" style="font-size:0.8rem;" onclick="app.creatorSellItem(${idx})" title="Vender de volta">🗑️</button>
      </div>
    `).join('');
  }

  updateCreatorStats() {
    const container = document.getElementById('creator-stats-preview');
    if (!container) return;

    const stats = this.calculateDerivedStats(this.newChar);
    
    container.innerHTML = `
      <div><strong>Classe de Armadura (CA):</strong> <span style="font-size:1.15rem; color:var(--accent-gold); font-weight:bold;">${stats.ac}</span> (Desviar: ${stats.flatFooted}, Toque: ${stats.touch})</div>
      <div><strong>Iniciativa:</strong> <span style="color:var(--accent-gold); font-weight:bold;">${stats.initiative >= 0 ? '+' + stats.initiative : stats.initiative}</span></div>
      <div><strong>Dado de Vida (HP Lvl 1):</strong> <span style="color:var(--accent-gold); font-weight:bold;">${stats.maxHp} PV</span> (${stats.hdDesc})</div>
      <div><strong>Jogadas de Salvamento:</strong>
        <div style="margin-left:10px; font-size:0.85rem; color:var(--text-muted);">
          Fortitude: <strong style="color:var(--text-parchment);">${stats.fort >= 0 ? '+' + stats.fort : stats.fort}</strong> (Base +${stats.fortBase})<br>
          Reflexos: <strong style="color:var(--text-parchment);">${stats.ref >= 0 ? '+' + stats.ref : stats.ref}</strong> (Base +${stats.refBase})<br>
          Vontade: <strong style="color:var(--text-parchment);">${stats.will >= 0 ? '+' + stats.will : stats.will}</strong> (Base +${stats.willBase})
        </div>
      </div>
      <div><strong>Base Attack Bonus (BAB):</strong> <span style="color:var(--accent-gold); font-weight:bold;">+${stats.bab}</span></div>
      <div><strong>Ataque Corpo-a-Corpo (Mêlée):</strong> <span style="color:var(--text-light); font-weight:bold;">${stats.melee >= 0 ? '+' + stats.melee : stats.melee}</span></div>
      <div><strong>Ataque de Longo Alcance:</strong> <span style="color:var(--text-light); font-weight:bold;">${stats.ranged >= 0 ? '+' + stats.ranged : stats.ranged}</span></div>
      <div><strong>Carga Total:</strong> <span style="color:var(--text-light); font-weight:bold;">${stats.totalWeight} kg</span> (Max: ${stats.maxCarry} kg)</div>
    `;
  }

  // OFFICIAL CHARACTER SHEET RENDERER AND LOGIC
  // OFFICIAL CHARACTER SHEET RENDERER AND LOGIC
  calculateClassBaseStats(classKey, level) {
    const classData = window.DND3_Classes[classKey] || window.DND3_Classes.fighter;
    
    // 1. Calculate BAB
    let bab = 0;
    const baseLevel = Math.min(level, 20);
    if (classData.babProgression === "good") {
      bab = baseLevel;
    } else if (classData.babProgression === "medium") {
      bab = Math.floor(baseLevel * 0.75);
    } else { // poor
      bab = Math.floor(baseLevel * 0.5);
    }
    
    if (level > 20) {
      bab += Math.floor((level - 19) / 2);
    }

    // 2. Calculate Base Saves (Fort, Ref, Will)
    const getBaseSave = (progType, lvl) => {
      const baseLvl = Math.min(lvl, 20);
      let saveVal = 0;
      if (progType === "good") {
        saveVal = 2 + Math.floor(baseLvl / 2);
      } else { // poor
        saveVal = Math.floor(baseLvl / 3);
      }
      if (lvl > 20) {
        saveVal += Math.floor((lvl - 19) / 2);
      }
      return saveVal;
    };

    const saveFort = getBaseSave(classData.fortSave, level);
    const saveRef = getBaseSave(classData.refSave, level);
    const saveWill = getBaseSave(classData.willSave, level);

    return {
      bab: bab,
      saveFort: saveFort,
      saveRef: saveRef,
      saveWill: saveWill
    };
  }

  getActiveConMod(char) {
    const baseObj = char.rollMethod === 'pointbuy' ? char.abilitiesBase : char.abilitiesRolls;
    const base = parseInt(baseObj?.con || char.abilitiesBase?.con) || 10;
    
    const rc = window.DND3_Races[char.race] || { modifiers: {} };
    const raceMod = parseInt(rc.modifiers?.con) || 0;
    
    const lvlUpMod = parseInt(char.levelUpAttributes?.con) || 0;
    
    const offsetVal = char.abilitiesTemp?.con;
    const offset = (offsetVal !== undefined && offsetVal !== null && offsetVal !== "" && !isNaN(parseInt(offsetVal))) ? parseInt(offsetVal) : 0;
    
    let armorPartMod = 0;
    if (char.equippedArmorParts && char.equippedArmorParts.length > 0) {
      char.equippedArmorParts.forEach(p => {
        if (p.attrMods && p.attrMods.con !== undefined) {
          armorPartMod += parseInt(p.attrMods.con) || 0;
        }
      });
    }
    
    const conVal = base + raceMod + lvlUpMod + offset + armorPartMod;
    return Math.floor((conVal - 10) / 2);
  }

  calculateBaseHpFromClasses(char) {
    if (!char.classes || char.classes.length === 0) {
      const clsKey = char.class || 'fighter';
      const hd = window.DND3_Classes[clsKey]?.hd || 10;
      const lvl = Math.max(1, char.level || 1);
      const firstLvl = hd;
      const avgSubsequent = Math.floor(hd / 2 + 1); // d4->3, d6->4, d8->5, d10->6, d12->7
      return firstLvl + (lvl - 1) * avgSubsequent;
    }

    let totalBaseHp = 0;
    let isFirstLevel = true;

    char.classes.forEach(c => {
      const hd = window.DND3_Classes[c.classKey]?.hd || 10;
      const lvl = Math.max(0, parseInt(c.level) || 0);
      if (lvl <= 0) return;

      const avgSubsequent = Math.floor(hd / 2 + 1);

      if (isFirstLevel) {
        totalBaseHp += hd;
        const subsequent = lvl - 1;
        totalBaseHp += subsequent * avgSubsequent;
        isFirstLevel = false;
      } else {
        totalBaseHp += lvl * avgSubsequent;
      }
    });

    return Math.max(1, totalBaseHp);
  }

  calculateTotalMaxHp(char) {
    const conMod = this.getActiveConMod(char);
    const totalLevel = Math.max(1, char.level || (char.classes ? char.classes.reduce((acc, c) => acc + (parseInt(c.level) || 0), 0) : 1));
    const toughnessCount = (char.feats || []).filter(f => f === 'toughness').length;
    const toughnessBonus = toughnessCount * 3;
    
    const extraRolled = Math.max(0, parseInt(char.hpRolled) || 0);
    const baseHp = this.calculateBaseHpFromClasses(char);
    
    // Minimum 1 HP per level even with negative CON mod
    const conBonus = totalLevel * conMod;
    const totalHp = Math.max(totalLevel, baseHp + conBonus + toughnessBonus + extraRolled);
    return totalHp;
  }

  updateMaxHp(char, forceRecalculate = false) {
    if (forceRecalculate || char.hpMax === undefined || char.hpMax === null || isNaN(char.hpMax) || char.hpMax <= 0) {
      char.hpMax = this.calculateTotalMaxHp(char);
    }
    
    if (char.currentHp === undefined || char.currentHp === null || isNaN(char.currentHp)) {
      char.currentHp = char.hpMax;
    } else if (char.currentHp > char.hpMax) {
      char.currentHp = char.hpMax;
    }
  }

  resetHpToStandard(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    char.hpRolled = 0;
    this.updateMaxHp(char, true);
    char.currentHp = char.hpMax;

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!isNew) {
      this.saveCharactersState();
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      if (container) this.renderOfficialSheet(char, container, true);
    }
    this.showToast(`PV recalculado para a média oficial das classes (${char.level}º Nível): ${char.hpMax} PV!`);
  }

  addHpRolled(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('#sheet-hp-rolled-input');
    if (!input) return;

    const val = parseInt(input.value) || 0;
    if (val <= 0) {
      alert("Por favor, insira um valor válido de dado de vida para somar.");
      return;
    }

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    char.hpRolled = (parseInt(char.hpRolled) || 0) + val;
    this.updateMaxHp(char);
    char.currentHp = Math.min(char.hpMax, (parseInt(char.currentHp) || 0) + val);

    input.value = '';

    // Save and re-render
    if (!isNew) {
      this.saveCharactersState();
      this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderOfficialSheet(char, container, true);
    }

    this.showToast(`Adicionado +${val} PV de rolagem física! Novo PV Total: ${char.hpMax}`);
  }

  normalizeCharacter(char, skipPrompts = false) {
    if (char.race) {
      const getRaceKey = (raceName) => {
        if (!raceName) return 'human';
        const normalized = raceName.trim().toLowerCase();
        if (normalized === 'humano' || normalized === 'human') return 'human';
        if (normalized === 'anão' || normalized === 'anao' || normalized === 'dwarf') return 'dwarf';
        if (normalized === 'elfo' || normalized === 'elf') return 'elf';
        if (normalized === 'gnomo' || normalized === 'gnome') return 'gnome';
        if (normalized === 'meio-elfo' || normalized === 'meio_elfo' || normalized === 'half_elf' || normalized === 'half-elf') return 'half_elf';
        if (normalized === 'meio-orc' || normalized === 'meio_orc' || normalized === 'half_orc' || normalized === 'half-orc') return 'half_orc';
        if (normalized === 'halfling') return 'halfling';
        if (normalized === 'meio-dragão' || normalized === 'meio-dragao' || normalized === 'meio_dragao' || normalized === 'half_dragon' || normalized === 'half-dragon') return 'half_dragon';
        if (normalized === 'meio-abissal' || normalized === 'meio_abissal' || normalized === 'half_fiend' || normalized === 'half-fiend') return 'half_fiend';
        if (normalized === 'vanara') return 'vanara';
        if (normalized === 'drow' || normalized === 'elfo negro' || normalized === 'elfo-negro' || normalized === 'elfo_negro' || normalized === 'dark elf' || normalized === 'dark-elf') return 'drow';
        if (normalized === 'meio-tigre' || normalized === 'meio_tigre' || normalized === 'half_tiger' || normalized === 'half-tiger') return 'half_tiger';
        if (normalized === 'meio-urso' || normalized === 'meio_urso' || normalized === 'half_bear' || normalized === 'half-bear') return 'half_bear';
        if (normalized === 'aasimar') return 'aasimar';
        if (normalized === 'tiefling') return 'tiefling';
        if (normalized === 'chivara' || normalized === 'povo-cabra' || normalized === 'povo_cabra' || normalized === 'goatfolk') return 'chivara';
        if (normalized === 'meio-celestial' || normalized === 'meio_celestial' || normalized === 'half_celestial' || normalized === 'half-celestial') return 'half_celestial';
        return normalized;
      };
      char.race = getRaceKey(char.race);
    }

    if (char.class) {
      const getClassKey = (className) => {
        if (!className) return 'fighter';
        const normalized = className.trim().toLowerCase();
        if (normalized === 'bárbaro' || normalized === 'barbaro' || normalized === 'barbarian') return 'barbarian';
        if (normalized === 'bardo' || normalized === 'bard') return 'bard';
        if (normalized === 'clérigo' || normalized === 'clerigo' || normalized === 'cleric') return 'cleric';
        if (normalized === 'druida' || normalized === 'druid') return 'druid';
        if (normalized === 'guerreiro' || normalized === 'fighter') return 'fighter';
        if (normalized === 'monge' || normalized === 'monk') return 'monk';
        if (normalized === 'paladino' || normalized === 'paladin') return 'paladin';
        if (normalized === 'rastreador' || normalized === 'ranger' || normalized === 'batedor') return 'ranger';
        if (normalized === 'ladino' || normalized === 'rogue') return 'rogue';
        if (normalized === 'feiticeiro' || normalized === 'sorcerer') return 'sorcerer';
        if (normalized === 'mago' || normalized === 'wizard') return 'wizard';
        return normalized;
      };
      char.class = getClassKey(char.class);
    }

    if (char.xpSessions && char.xpSessions.length > 0) {
      char.xp = char.xpSessions.reduce((acc, curr) => acc + curr.xpAmt, 0);
    }
    if (char.xp === undefined || char.xp === null || char.xp < 0) {
      char.xp = 0;
    }

    const oldLevel = char.level || 1;
    const newLvl = this.getLevelFromXp(char.xp);

    if (!skipPrompts) {
      if (newLvl > oldLevel) {
        this.levelUpInProgress = true;
        // Defer level up to the interactive modal
        setTimeout(() => {
          this.promptLevelUp(char, oldLevel, newLvl);
        }, 0);
      } else if (newLvl < oldLevel) {
        this.handleLevelDown(char, oldLevel, newLvl);
      }
    }

    if (!char.classes || char.classes.length === 0) {
      char.classes = [ { classKey: char.class || 'fighter', level: newLvl } ];
    } else {
      // Sync single class key to class field if only one class exists
      if (char.classes.length === 1 && char.classes[0].classKey !== char.class && char.class) {
        char.classes[0].classKey = char.class;
      }

      let totalClassLvl = char.classes.reduce((acc, c) => acc + c.level, 0);
      if (totalClassLvl !== newLvl) {
        const diff = newLvl - totalClassLvl;
        if (diff > 0) {
          if (skipPrompts && !this.levelUpInProgress) {
            char.classes[0].level += diff;
          }
          // If !skipPrompts, it is deferred to the modal, so we do nothing here.
        } else {
          let levelsToRemove = Math.abs(diff);
          for (let i = char.classes.length - 1; i >= 0; i--) {
            if (char.classes[i].level > levelsToRemove) {
              char.classes[i].level -= levelsToRemove;
              levelsToRemove = 0;
              break;
            } else {
              levelsToRemove -= (char.classes[i].level - 1);
              char.classes[i].level = 1;
            }
          }
          if (levelsToRemove > 0) {
            char.classes[0].level = Math.max(1, char.classes[0].level - levelsToRemove);
          }
        }
      }
    }
    
    char.level = char.classes.reduce((acc, c) => acc + c.level, 0);
    if (char.classes.length > 0) {
      char.class = char.classes[0].classKey;
    }

    const classNames = char.classes.map(c => `${window.DND3_Classes[c.classKey]?.name || c.classKey} ${c.level}`);
    char.classDisplay = classNames.join(' / ');

    // Initialize levelUpAttributes if not exists
    if (!char.levelUpAttributes) {
      char.levelUpAttributes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    }
    // Enforce levelUpAttributes limit based on total level
    const allowedLvlUp = Math.floor((char.level || 1) / 4);
    let allocatedLvlUp = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((acc, a) => acc + (char.levelUpAttributes[a] || 0), 0);
    if (allocatedLvlUp > allowedLvlUp) {
      let overage = allocatedLvlUp - allowedLvlUp;
      const attrs = ['cha', 'wis', 'int', 'con', 'dex', 'str'];
      for (let a of attrs) {
        if (overage <= 0) break;
        const current = char.levelUpAttributes[a] || 0;
        if (current > 0) {
          const toSub = Math.min(current, overage);
          char.levelUpAttributes[a] -= toSub;
          overage -= toSub;
        }
      }
    }

    if (char.currentHp === undefined) {
      char.currentHp = char.hpMax || 10;
    }
    this.updateMaxHp(char);

    if (!char.xpSessions) char.xpSessions = [];
    if (!char.specialAbilities) char.specialAbilities = [];
    if (!char.feats) char.feats = [];
    if (!char.activeFeats) char.activeFeats = {};
    if (!char.activeSpecialAbilities) char.activeSpecialAbilities = {};
    if (!char.abilitiesBase) char.abilitiesBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    if (!char.levelUpAttributes) char.levelUpAttributes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    if (!char.abilitiesTemp) {
      char.abilitiesTemp = { str: "", dex: "", con: "", int: "", wis: "", cha: "" };
    } else {
      ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => {
        if (char.abilitiesTemp[a] === char.abilitiesBase[a]) {
          char.abilitiesTemp[a] = "";
        }
      });
    }
    if (!char.coins) char.coins = { gp: 0, pp: 0, sp: 0, cp: 0 };
    if (!char.weapons) {
      char.weapons = [
        { name: "", attack: "", damage: "", damageBase: "", damageMod: "", critical: "", range: "", type: "", notes: "" }
      ];
    } else {
      char.weapons.forEach(w => {
        if (w.damage && (w.damageBase === undefined || w.damageBase === null || w.damageBase === "")) {
          const match = w.damage.match(/^(\d+d\d+)\s*([+-]\s*\d+)?$/i);
          if (match) {
            w.damageBase = match[1];
            w.damageMod = match[2] ? match[2].replace(/\s+/g, '') : '+0';
          } else {
            w.damageBase = w.damage;
            w.damageMod = '+0';
          }
        }
        if (w.damageBase === undefined) w.damageBase = '';
        if (w.damageMod === undefined) w.damageMod = '';
      });
    }
    if (!char.skillRanks) char.skillRanks = {};
    if (!char.skillMisc) char.skillMisc = {};

    if (!char.languages) {
      if (char.languagesText) {
        char.languages = char.languagesText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      } else {
        char.languages = ["Comum"];
      }
    }
    if (char.meleeMisc === undefined) char.meleeMisc = 0;
    if (char.meleeTemp === undefined) char.meleeTemp = 0;
    if (char.rangedMisc === undefined) char.rangedMisc = 0;
    if (char.rangedTemp === undefined) char.rangedTemp = 0;

    if (!char.initiativeMods) {
      const oldMisc = parseInt(char.initiativeMisc) || 0;
      char.initiativeMods = [
        { val: oldMisc, desc: oldMisc !== 0 ? "Modificador Geral" : "" },
        { val: 0, desc: "" },
        { val: 0, desc: "" }
      ];
    }

    // Auto-update base stats if classes or level changed
    const classesHash = (char.classes || []).map(c => `${c.classKey}:${c.level}`).join(',');
    if (char.bab === undefined || classesHash !== char._lastCalcClassesHash) {
      let bab = 0;
      let saveFort = 0;
      let saveRef = 0;
      let saveWill = 0;
      
      (char.classes || []).forEach(c => {
        const stats = this.calculateClassBaseStats(c.classKey, c.level);
        bab += stats.bab;
        saveFort += stats.saveFort;
        saveRef += stats.saveRef;
        saveWill += stats.saveWill;
      });
      
      char.bab = bab;
      char.saveFortBase = saveFort;
      char.saveRefBase = saveRef;
      char.saveWillBase = saveWill;
      char._lastCalcClassesHash = classesHash;
    }
  }

  calculateDerivedStats(char) {
    this.normalizeCharacter(char);
    const baseObj = char.abilitiesBase;
    const rc = window.DND3_Races[char.race] || { modifiers: {} };

    const getActiveAttr = (attr) => {
      const base = parseInt(baseObj?.[attr]) || 10;
      const raceMod = parseInt(rc.modifiers?.[attr]) || 0;
      const lvlUpMod = parseInt(char.levelUpAttributes?.[attr]) || 0;
      const offsetVal = char.abilitiesTemp?.[attr];
      const offset = (offsetVal !== undefined && offsetVal !== null && offsetVal !== "" && !isNaN(parseInt(offsetVal))) ? parseInt(offsetVal) : 0;
      
      let armorPartMod = 0;
      if (char.equippedArmorParts && char.equippedArmorParts.length > 0) {
        char.equippedArmorParts.forEach(p => {
          if (p.attrMods && p.attrMods[attr] !== undefined) {
            armorPartMod += parseInt(p.attrMods[attr]) || 0;
          }
        });
      }
      
      return base + raceMod + lvlUpMod + offset + armorPartMod;
    };

    const strMod = Math.floor((getActiveAttr('str') - 10) / 2);
    const dexMod = Math.floor((getActiveAttr('dex') - 10) / 2);
    const conMod = Math.floor((getActiveAttr('con') - 10) / 2);
    const intMod = Math.floor((getActiveAttr('int') - 10) / 2);
    const wisMod = Math.floor((getActiveAttr('wis') - 10) / 2);
    const chaMod = Math.floor((getActiveAttr('cha') - 10) / 2);

    const racialSaveBonus = char.race === 'halfling' ? 1 : 0;

    const fortBaseVal = parseInt(char.saveFortBase) || 0;
    const fortMagicVal = parseInt(char.saveFortMagic) || 0;
    const fortMiscVal = parseInt(char.saveFortMisc) || 0;
    const fortTempVal = parseInt(char.saveFortTemp) || 0;
    const fortTotal = fortBaseVal + conMod + fortMagicVal + fortMiscVal + fortTempVal + racialSaveBonus;

    const refBaseVal = parseInt(char.saveRefBase) || 0;
    const refMagicVal = parseInt(char.saveRefMagic) || 0;
    const refMiscVal = parseInt(char.saveRefMisc) || 0;
    const refTempVal = parseInt(char.saveRefTemp) || 0;
    const refTotal = refBaseVal + dexMod + refMagicVal + refMiscVal + refTempVal + racialSaveBonus;

    const willBaseVal = parseInt(char.saveWillBase) || 0;
    const willMagicVal = parseInt(char.saveWillMagic) || 0;
    const willMiscVal = parseInt(char.saveWillMisc) || 0;
    const willTempVal = parseInt(char.saveWillTemp) || 0;
    const willTotal = willBaseVal + wisMod + willMagicVal + willMiscVal + willTempVal + racialSaveBonus;

    let maxDexVal = 99;
    if (char.armorMaxDex !== undefined && char.armorMaxDex !== null && char.armorMaxDex !== "") {
      const parsed = parseInt(char.armorMaxDex);
      if (!isNaN(parsed)) {
        maxDexVal = parsed;
      }
    }
    const appliedDex = Math.min(dexMod, maxDexVal);

    const initMiscTotal = (char.initiativeMods || []).reduce((acc, curr) => acc + (parseInt(curr.val) || 0), 0);
    const init = dexMod + initMiscTotal;

    const acArmorVal = parseInt(char.acArmor) || 0;
    const acShieldVal = parseInt(char.acShield) || 0;
    const acSizeVal = parseInt(char.acSize) || 0;
    const acNaturalVal = parseInt(char.acNatural) || 0;
    const acDeflectionVal = parseInt(char.acDeflection) || 0;
    const acMiscVal = parseInt(char.acMisc) || 0;

    const acTotal = 10 + acArmorVal + acShieldVal + appliedDex + acSizeVal + acNaturalVal + acDeflectionVal + acMiscVal;
    const flatFooted = 10 + acArmorVal + acShieldVal + acSizeVal + acNaturalVal + acDeflectionVal + acMiscVal;
    const touch = 10 + appliedDex + acSizeVal + acDeflectionVal + acMiscVal;

    const babVal = parseInt(char.bab) || 0;
    const melee = babVal + strMod + acSizeVal;
    const ranged = babVal + dexMod + acSizeVal;

    return {
      abilities: {
        str: getActiveAttr('str'),
        dex: getActiveAttr('dex'),
        con: getActiveAttr('con'),
        int: getActiveAttr('int'),
        wis: getActiveAttr('wis'),
        cha: getActiveAttr('cha')
      },
      mods: { str: strMod, dex: dexMod, con: conMod, int: intMod, wis: wisMod, cha: chaMod },
      fort: fortTotal,
      ref: refTotal,
      will: willTotal,
      fortBase: fortBaseVal,
      refBase: refBaseVal,
      willBase: willBaseVal,
      ac: acTotal,
      flatFooted: flatFooted,
      touch: touch,
      initiative: init,
      maxHp: char.hpMax || 10,
      bab: babVal,
      melee: melee,
      ranged: ranged
    };
  }

  renderOfficialSheet(char, container, isNewChar = false) {
    this.normalizeCharacter(char, true);
    const activeSubtab = this.activeSheetSubtab || 'page1';

    // Calculate HP and Challenge Rating (ND) details
    const hdSize = window.DND3_Classes[char.class]?.hd || 10;
    const stats = this.calculateDerivedStats(char);
    const conMod = stats.mods.con;
    const hpAutomatic = hdSize + (char.level * conMod);
    char._lastCalculatedConMod = conMod;

    const prestigeClassesList = ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'];
    const prestigeLvlCount = (char.classes || []).filter(c => prestigeClassesList.includes(c.classKey)).reduce((sum, c) => sum + (parseInt(c.level) || 0), 0);
    const calculatedND = char.level || 1;

    const isDmUser = this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin');

    let html = `
      <div class="dnd-sheet-container">
        ${(isNewChar && isDmUser) ? this.renderDmCharacterGeneratorBanner(char) : ''}
        <!-- Main Sheet Header -->
        <div class="dnd-sheet-header">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <h2 style="font-size:1.8rem; letter-spacing:0.1em; color:#5a3e09; margin:0; font-family:var(--font-header);">VALEIROS GUERRENTES</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              <button class="rpg-btn" style="background:#5a3e09; border-color:#5a3e09; color:#fdfaf2; padding:6px 15px;" onclick="app.saveCharacterSheet('${char.id}', ${isNewChar})">Salvar Ficha</button>
              ${isNewChar ? `
                <label class="rpg-btn" style="background:linear-gradient(135deg, #1e40af, #2563eb); border-color:#1d4ed8; color:#ffffff; cursor:pointer; display:inline-flex; align-items:center; gap:6px; font-weight:bold; padding:6px 12px; font-size:0.82rem; border-radius:4px; margin:0;">
                  📥 Importar .xlsx
                  <input type="file" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none;" onchange="app.importCharacterFromExcel(event)">
                </label>
              ` : `
                <button class="rpg-btn" style="background:linear-gradient(135deg, #1e40af, #2563eb); border-color:#1d4ed8; color:#ffffff; padding:6px 12px; font-size:0.82rem; font-weight:bold;" onclick="app.exportCharacterToExcel('${char.id}')">📤 Exportar .xlsx</button>
                <button class="rpg-btn" style="background:var(--accent-gold); border-color:transparent; color:#000; padding:6px 15px; font-weight:bold;" onclick="app.sheetEditModal('${char.id}')">Editar Ficha</button>
                <button class="rpg-btn rpg-btn-secondary" style="border-color:#5a3e09; color:#5a3e09; padding:6px 15px;" onclick="app.closeCharacterSheet()">Voltar para Lista</button>
              `}
            </div>
          </div>
        </div>
          
          <div style="display: flex; gap: 20px; margin-top: 1rem; align-items: flex-start; flex-wrap: wrap;">
            <!-- Portrait Column -->
            <div class="char-portrait-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 120px; height: 140px; border: 2px dashed rgba(170,124,17,0.4); border-radius: 6px; background: rgba(0,0,0,0.02); cursor: pointer; position: relative; overflow: hidden; box-sizing: border-box; flex-shrink: 0; margin-top: 10px;" onclick="this.querySelector('input').click()">
              ${char.avatar ? `<img src="${char.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `
                <span style="font-size: 2rem; color: rgba(170,124,17,0.5);">👤</span>
                <span style="font-size: 0.65rem; color: #5a3e09; font-weight: bold; text-align: center; padding: 4px;">Enviar Foto</span>
              `}
              <input type="file" accept="image/*" style="display: none;" onchange="app.handleAvatarUpload(event, '${char.id}', ${isNewChar})">
            </div>
            
            <div class="sheet-header-grid" style="flex: 1; margin-top: 0; min-width: 250px;">
            <div class="header-char-name">
              <label>Nome do Personagem</label>
              <input type="text" value="${char.name || ''}" data-path="name" placeholder="Nome do Herói...">
            </div>
            <div class="header-player">
              <label>Jogador</label>
              <input type="text" value="${char.player || ''}" data-path="player" placeholder="Nome do Jogador...">
            </div>
            <div class="header-class">
              <label>Classe</label>
              ${!isNewChar ? `
                <input type="text" value="${char.classDisplay || ''}" disabled style="background:rgba(0,0,0,0.05); color:var(--text-light); font-weight:bold;">
              ` : `
                <select data-path="class">
                  <optgroup label="Classes Básicas">
                    ${Object.keys(window.DND3_Classes).filter(k => !['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(k)).map(k => `<option value="${k}" ${char.class === k ? 'selected' : ''}>${window.DND3_Classes[k].name}</option>`).join('')}
                  </optgroup>
                  <optgroup label="Classes de Prestígio">
                    ${Object.keys(window.DND3_Classes).filter(k => ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(k)).map(k => `<option value="${k}" ${char.class === k ? 'selected' : ''}>${window.DND3_Classes[k].name}</option>`).join('')}
                  </optgroup>
                </select>
              `}
            </div>
            <div class="header-level" style="display:flex; flex-direction:column; gap:2px;">
              <label>Nível</label>
              <input type="number" value="${char.level || 1}" data-path="level" min="1" style="text-align:center;" disabled title="O nível é calculado automaticamente a partir dos Pontos de Experiência (XP).">
            </div>
            <div class="header-nd" style="display:flex; flex-direction:column; gap:2px;">
              <label style="font-weight:bold; color:var(--accent-gold); display:flex; justify-content:space-between; align-items:center;">
                <span>ND</span>
                ${prestigeLvlCount > 0 ? `<span style="font-size:0.6rem; background:rgba(212,175,55,0.2); color:#5a3e09; padding:1px 4px; border-radius:3px;" title="Ajuste de ND por Níveis de Classe de Prestígio">+${prestigeLvlCount} Prest.</span>` : ''}
              </label>
              <input type="number" value="${char.cr !== undefined && char.cr !== null ? char.cr : calculatedND}" data-path="cr" min="1" style="text-align:center; font-weight:bold; width:100%; height:32px; border:1px solid #5a3e09; border-radius:4px; background:#fff; color:#5a3e09;" title="Nível de Desafio (ND). Inclui ajuste de níveis de classes de prestígio e raça.">
            </div>
            <div class="header-race-sex" style="display: flex; gap: 8px; flex-wrap: wrap;">
              <div style="flex: 2; min-width: 120px;">
                <label>Raça</label>
                <select data-path="race" style="width: 100%;">
                  ${Object.keys(window.DND3_Races).map(k => {
                    const r = window.DND3_Races[k];
                    let modsText = [];
                    for (let attr in r.modifiers) {
                      if (r.modifiers[attr] !== 0) {
                        modsText.push(`${attr.toUpperCase()}: ${r.modifiers[attr] > 0 ? '+' + r.modifiers[attr] : r.modifiers[attr]}`);
                      }
                    }
                    const modsStr = modsText.length > 0 ? ` (${modsText.join(', ')})` : '';
                    return `<option value="${k}" ${char.race === k ? 'selected' : ''}>${r.name}${modsStr}</option>`;
                  }).join('')}
                </select>
              </div>
              <div style="flex: 1;">
                <label style="font-size: 0.75rem;">Sexo</label>
                <select data-path="gender" style="font-size: 0.8rem; text-align: center; width: 100%; height: 32px; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; background: #fff; box-sizing: border-box; padding: 2px;">
                  <option value="" ${!char.gender ? 'selected' : ''}>--</option>
                  <option value="M" ${char.gender === 'M' ? 'selected' : ''}>M</option>
                  <option value="F" ${char.gender === 'F' ? 'selected' : ''}>F</option>
                </select>
              </div>
            </div>
            <div class="header-alignment">
              <label>Alinhamento</label>
              <select data-path="alignment">
                <option value="lg" ${char.alignment === 'lg' ? 'selected' : ''}>Leal e Bom</option>
                <option value="ln" ${char.alignment === 'ln' ? 'selected' : ''}>Leal e Neutro</option>
                <option value="le" ${char.alignment === 'le' ? 'selected' : ''}>Leal e Mau</option>
                <option value="ng" ${char.alignment === 'ng' ? 'selected' : ''}>Neutro e Bom</option>
                <option value="tn" ${char.alignment === 'tn' ? 'selected' : ''}>Neutro Neutro</option>
                <option value="ne" ${char.alignment === 'ne' ? 'selected' : ''}>Neutro e Mau</option>
                <option value="cg" ${char.alignment === 'cg' ? 'selected' : ''}>Caótico e Bom</option>
                <option value="cn" ${char.alignment === 'cn' ? 'selected' : ''}>Caótico e Neutro</option>
                <option value="ce" ${char.alignment === 'ce' ? 'selected' : ''}>Caótico e Mau</option>
              </select>
            </div>
            <div class="header-deity" style="display:flex; flex-direction:column; gap:2px;">
              <label>Divindade</label>
              <select data-path="deity" style="width:100%; height:32px; font-size:0.8rem;">
                ${Object.keys(window.DND3_Deities || {}).map(k => {
                  const d = window.DND3_Deities[k];
                  const isSelected = char.deity === k ? 'selected' : '';
                  return `<option value="${k}" ${isSelected}>${d.name} (${d.alignment})</option>`;
                }).join('')}
              </select>
              <div style="font-size:0.6rem; color:#8b0000; font-weight:bold; margin-top:2px; line-height:1.1;" id="sheet-deity-bonus-desc">
                ${(window.DND3_Deities && window.DND3_Deities[char.deity]) ? window.DND3_Deities[char.deity].bonusDesc : 'Bônus de Domínio: Nenhum.'}
              </div>
            </div>
            <div class="header-height">
              <label>Altura</label>
              <input type="text" value="${char.height || ''}" data-path="height">
            </div>
            <div class="header-weight">
              <label>Peso</label>
              <input type="text" value="${char.weight || ''}" data-path="weight">
            </div>
            <div class="header-age">
              <label>Idade</label>
              <input type="text" value="${char.age || ''}" data-path="age">
            </div>
            <div class="header-size">
              <label>Tamanho</label>
              <select data-path="size">
                <option value="Fine" ${char.size === 'Fine' ? 'selected' : ''}>Ínfimo [+8]</option>
                <option value="Diminutive" ${char.size === 'Diminutive' ? 'selected' : ''}>Miúdo [+4]</option>
                <option value="Tiny" ${char.size === 'Tiny' ? 'selected' : ''}>Minúsculo [+2]</option>
                <option value="Small" ${char.size === 'Small' ? 'selected' : ''}>Pequeno [+1]</option>
                <option value="Medium" ${char.size === 'Medium' ? 'selected' : ''}>Médio [+0]</option>
                <option value="Large" ${char.size === 'Large' ? 'selected' : ''}>Grande [-1]</option>
                <option value="Huge" ${char.size === 'Huge' ? 'selected' : ''}>Enorme [-2]</option>
                <option value="Gargantuan" ${char.size === 'Gargantuan' ? 'selected' : ''}>Gargante [-4]</option>
                <option value="Colossal" ${char.size === 'Colossal' ? 'selected' : ''}>Colossal [-8]</option>
              </select>
            </div>
            <div class="header-sr">
              <label>RM</label>
              <input type="number" value="${char.sr || 0}" data-path="sr" style="text-align:center;">
            </div>
            ${(() => {
              const curLvl = char.level || 1;
              const curLvlMinXp = this.getXpRequiredForLevel(curLvl);
              const nextLvlMinXp = this.getXpRequiredForLevel(curLvl + 1);
              const currentXp = char.xp || 0;
              const xpInCurrentLvl = Math.max(0, currentXp - curLvlMinXp);
              const xpNeededForNext = Math.max(1, nextLvlMinXp - curLvlMinXp);
              const xpProgressPct = Math.min(100, Math.max(0, Math.round((xpInCurrentLvl / xpNeededForNext) * 100)));
              const xpRemaining = Math.max(0, nextLvlMinXp - currentXp);
              return `
                <div class="header-xp" style="grid-column: span 3; background: rgba(170, 124, 17, 0.05); border: 1px solid rgba(170, 124, 17, 0.25); padding: 10px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                    <label style="font-weight: bold; color: #5a3e09; font-family: 'Cinzel', serif; font-size: 0.85rem; margin: 0;">Experiência (XP)</label>
                    <div style="display: flex; align-items: center; gap: 5px;">
                      <span style="font-size: 0.8rem; color: #777;">Total:</span>
                      <input type="number" id="sheet-xp-total-input" value="${currentXp}" data-path="xp" style="font-size: 1rem; text-align: center; font-weight: bold; color: #aa7c11; width: 100px; padding: 2px; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; background: #fff;">
                    </div>
                  </div>

                  <!-- Next Level Progress Tracker -->
                  <div style="background: rgba(0,0,0,0.03); border: 1px solid rgba(170,124,17,0.15); border-radius: 4px; padding: 6px 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #5a3e09; font-weight: bold; margin-bottom: 3px;">
                      <span>Nível ${curLvl} (${curLvlMinXp.toLocaleString('pt-BR')} XP)</span>
                      <span>Próximo: Nível ${curLvl + 1} (${nextLvlMinXp.toLocaleString('pt-BR')} XP)</span>
                    </div>
                    <div style="background: #e2d7c5; border-radius: 4px; height: 10px; overflow: hidden; position: relative; border: 1px solid rgba(170,124,17,0.2);">
                      <div style="background: linear-gradient(90deg, #d4af37, #f59e0b); height: 100%; width: ${xpProgressPct}%; transition: width 0.3s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: #777; margin-top: 3px;">
                      <span>Progresso: <strong>${xpProgressPct}%</strong></span>
                      <span>Faltam: <strong style="color: ${xpRemaining === 0 ? '#2ecc71' : '#aa7c11'};">${xpRemaining.toLocaleString('pt-BR')} XP</strong></span>
                    </div>
                  </div>
                  
                  <div style="border-top: 1px solid rgba(170, 124, 17, 0.15); padding-top: 5px;">
                    <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 4px;">Registro de XP por Sessão</div>
                    <div id="sheet-xp-sessions-list-container" style="max-height: 80px; overflow-y: auto; margin-bottom: 5px; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 3px;">
                      <!-- Dynamically populated session table -->
                    </div>
                    
                    <div class="xp-session-controls" style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                      <input type="text" id="new-session-name" placeholder="Sessão (ex: #5)" style="flex: 2; font-size: 0.75rem; padding: 2px 5px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #fff; box-sizing: border-box; color: #000000;">
                      <select id="new-session-op" style="width: 45px; font-size: 0.75rem; padding: 2px; height: 24px; border: 1px solid #ccc; border-radius: 3px; background: #fff; box-sizing: border-box; color: #000000;">
                        <option value="+">+</option>
                        <option value="-">-</option>
                      </select>
                      <input type="number" id="new-session-xp" placeholder="XP" style="width: 80px; font-size: 0.75rem; padding: 2px 5px; height: 24px; text-align: center; border: 1px solid #ccc; border-radius: 3px; background: #fff; box-sizing: border-box; color: #000000;">
                      <button class="rpg-btn" style="padding: 2px 8px; font-size: 0.75rem; height: 24px; display: flex; align-items: center; justify-content: center; line-height: 1;" onclick="app.addSessionXP('${char.id}', ${isNewChar})">Add</button>
                      <button class="rpg-btn" style="padding: 2px 8px; font-size: 0.75rem; height: 24px; display: flex; align-items: center; justify-content: center; line-height: 1; background: #ff4444; border-color: #ff4444; color: #fff;" onclick="app.clearSessionXP('${char.id}', ${isNewChar})" title="Limpar Histórico de XP">Limpar</button>
                    </div>
                  </div>
                </div>
              `;
            })()}
          </div>
        </div>
      </div>

        <!-- Sheet Sub Navigation -->
        <div class="sheet-sub-tabs">
          <button class="sheet-sub-tab-btn ${activeSubtab === 'page1' ? 'active' : ''}" id="sheet-btn-page1" onclick="app.switchSheetSubtab('page1', this)">Pág 1: Frente & Combate</button>
          <button class="sheet-sub-tab-btn ${activeSubtab === 'page2' ? 'active' : ''}" id="sheet-btn-page2" onclick="app.switchSheetSubtab('page2', this)">Pág 2: Perícias & Talentos</button>
          <button class="sheet-sub-tab-btn ${activeSubtab === 'page3' ? 'active' : ''}" id="sheet-btn-page3" onclick="app.switchSheetSubtab('page3', this)">Pág 3: Equipamentos & Carga</button>
          <button class="sheet-sub-tab-btn ${activeSubtab === 'page4' ? 'active' : ''}" id="sheet-btn-page4" onclick="app.switchSheetSubtab('page4', this)">Pág 4: Magias & Notas/XP</button>
        </div>

        <!-- PAGE 1: FRENTE & COMBATE -->
        <div class="sheet-sub-tab-content" id="sheet-sec-page1" style="display: ${activeSubtab === 'page1' ? 'block' : 'none'};">
          <div class="sheet-grid-2">
            
            <!-- Abilities and Saves Column -->
            <div>
                <div class="sheet-block">
                <div class="sheet-block-title" style="display:flex; justify-content:space-between; align-items:center;">
                  Valores de Atributo
                  ${(char.specialAbilities || []).includes('rage') ? `
                    <label style="font-size:0.75rem; font-weight:normal; display:inline-flex; align-items:center; gap:4px; text-transform:none; cursor:pointer; color:#aa7c11; margin:0;">
                      <input type="checkbox" data-path="rageActive" ${char.rageActive ? 'checked' : ''} style="margin:0; width:14px; height:14px;">
                      <strong>Ativar Fúria</strong>
                    </label>
                  ` : ''}
                </div>
                <table class="dnd-abilities-table" style="width:100%; border-collapse:collapse; text-align:center;">
                  <thead>
                    <tr style="font-size:0.6rem; font-weight:bold; color:#5a3e09; text-transform:uppercase;">
                      <th style="width:20%; padding:2px; font-family:'Cinzel', serif;">Habilidade</th>
                      <th style="width:15%; padding:2px; font-family:'Cinzel', serif;">Valor</th>
                      <th style="width:15%; padding:2px; font-family:'Cinzel', serif;">Mod. Base</th>
                      <th style="width:16%; padding:2px; background:#d4c4a8; border-radius: 4px 4px 0 0; color:#3e2a05; font-family:'Cinzel', serif;">Valor Temp.</th>
                      <th style="width:16%; padding:2px; background:#d4c4a8; border-radius: 4px 4px 0 0; color:#3e2a05; font-family:'Cinzel', serif;">Mod. Temp.</th>
                      <th style="width:18%; padding:2px; background:#e5d3b3; border-radius: 4px 4px 0 0; color:#3e2a05; font-family:'Cinzel', serif;">Mod. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => {
                      const rc = window.DND3_Races[char.race] || { modifiers: {} };
                      const raceMod = rc.modifiers?.[a] || 0;
                      const rawBase = char.abilitiesBase[a] || 10;
                      const base = rawBase + raceMod;
                      const tempVal = char.abilitiesTemp[a] !== undefined && char.abilitiesTemp[a] !== null && char.abilitiesTemp[a] !== "" ? char.abilitiesTemp[a] : "";
                      const offset = tempVal !== "" ? parseInt(tempVal) : 0;
                      
                      const isRageActive = (char.specialAbilities || []).includes('rage') && char.rageActive;
                      let rageBonus = 0;
                      if (isRageActive && (a === 'str' || a === 'con')) {
                        rageBonus = 4;
                      }
                      
                      const baseMod = Math.floor((base - 10) / 2);
                      const totalVal = base + offset + rageBonus;
                      const totalMod = Math.floor((totalVal - 10) / 2);
                      const tempMod = totalMod - baseMod;

                      const aNames = {
                        str: { abbrev: 'FOR', name: 'FORÇA' },
                        dex: { abbrev: 'DES', name: 'DESTREZA' },
                        con: { abbrev: 'CONS', name: 'CONSTITUIÇÃO' },
                        int: { abbrev: 'INT', name: 'INTELIGÊNCIA' },
                        wis: { abbrev: 'SAB', name: 'SABEDORIA' },
                        cha: { abbrev: 'CAR', name: 'CARISMA' }
                      };
                      
                      return `
                        <tr style="height:48px;">
                          <!-- Column 1: Black box, white text -->
                          <td style="padding:2px;">
                            <div style="background:#000; color:#fff; border-radius:3px; padding:4px 1px; text-align:center; font-family:'Cinzel', serif; line-height:1.1; box-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                              <div style="font-size:0.9rem; font-weight:bold; letter-spacing:0.02em;">${aNames[a].abbrev}</div>
                              <div style="font-size:0.45rem; opacity:0.8; letter-spacing:0.01em; font-family:'Inter', sans-serif;">${aNames[a].name}</div>
                            </div>
                          </td>
                          <!-- Column 2: Valor de habilidade input -->
                          <td style="padding:2px;">
                            <input type="number" value="${base}" data-path="abilitiesBase.${a}" style="width:100%; max-width:55px; height:28px; text-align:center; font-size:1rem; font-weight:bold; border:2px solid #5a3e09; border-radius:4px; box-sizing:border-box; background:#fff; color:#000;">
                          </td>
                          <!-- Column 3: Modif display -->
                          <td style="padding:2px;">
                            <div id="sheet-mod-${a}" class="sheet-stat-total" style="width:100%; max-width:55px; height:28px; display:inline-flex; align-items:center; justify-content:center; font-size:1rem; font-weight:bold; border:2px solid #5a3e09; border-radius:4px; background:#fdfaf2; box-sizing:border-box; color:#1a1a1a;">
                              ${baseMod >= 0 ? '+' + baseMod : baseMod}
                            </div>
                          </td>
                          <!-- Column 4: Valor temporário input (grey background cell) -->
                          <td style="padding:2px; background:rgba(0,0,0,0.04); border-left: 1px solid rgba(0,0,0,0.02);">
                            <input type="number" value="${tempVal}" data-path="abilitiesTemp.${a}" placeholder="--" style="width:100%; max-width:55px; height:28px; text-align:center; font-size:1rem; border:2px solid #777; border-radius:4px; background:#fff; box-sizing:border-box; color:#000;">
                          </td>
                          <!-- Column 5: Mod temporário display (grey background cell) -->
                          <td style="padding:2px; background:rgba(0,0,0,0.04);">
                            <div id="sheet-modtemp-${a}" style="width:100%; max-width:55px; height:28px; display:inline-flex; align-items:center; justify-content:center; font-size:1rem; font-weight:bold; border:2px solid #777; border-radius:4px; background:#fff; box-sizing:border-box; ${tempMod !== 0 ? 'color:#aa7c11;' : 'color:#555;'}">
                              ${tempMod >= 0 ? '+' + tempMod : tempMod}
                            </div>
                          </td>
                          <!-- Column 6: Mod total display (gold border/tint cell) -->
                          <td style="padding:2px; background:rgba(170,124,17,0.04); border-right: 1px solid rgba(170,124,17,0.02);">
                            <div id="sheet-totalmod-${a}" style="width:100%; max-width:55px; height:28px; display:inline-flex; align-items:center; justify-content:center; font-size:1rem; font-weight:bold; border:2px solid var(--accent-gold-dark); border-radius:4px; background:#fff; box-sizing:border-box; color:#1a1a1a;">
                              ${totalMod >= 0 ? '+' + totalMod : totalMod}
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <div class="sheet-block">
                <div class="sheet-block-title">Testes de Resistência</div>
                <table class="sheet-table dnd-saves-table">
                  <thead>
                    <tr>
                      <th style="text-align:left;">Resistência</th>
                      <th>Total</th>
                      <th>Base</th>
                      <th>Mod Atr</th>
                      <th>Magia</th>
                      <th>Outros</th>
                      <th>Temp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="sheet-ability-name rollable" onclick="app.rollFromSheet('Fortitude', parseInt(document.getElementById('sheet-save-fort-total').textContent))">Fortitude (CON)</td>
                      <td id="sheet-save-fort-total" class="sheet-stat-total" style="font-size:1.1rem;">0</td>
                      <td><input type="number" value="${char.saveFortBase || 0}" data-path="saveFortBase" style="width:50px;"></td>
                      <td id="sheet-save-fort-mod" style="text-align:center; font-weight:bold;">0</td>
                      <td><input type="number" value="${char.saveFortMagic || 0}" data-path="saveFortMagic" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveFortMisc || 0}" data-path="saveFortMisc" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveFortTemp || 0}" data-path="saveFortTemp" style="width:50px;"></td>
                    </tr>
                    <tr>
                      <td class="sheet-ability-name rollable" onclick="app.rollFromSheet('Reflexos', parseInt(document.getElementById('sheet-save-ref-total').textContent))">Reflexos (DES)</td>
                      <td id="sheet-save-ref-total" class="sheet-stat-total" style="font-size:1.1rem;">0</td>
                      <td><input type="number" value="${char.saveRefBase || 0}" data-path="saveRefBase" style="width:50px;"></td>
                      <td id="sheet-save-ref-mod" style="text-align:center; font-weight:bold;">0</td>
                      <td><input type="number" value="${char.saveRefMagic || 0}" data-path="saveRefMagic" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveRefMisc || 0}" data-path="saveRefMisc" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveRefTemp || 0}" data-path="saveRefTemp" style="width:50px;"></td>
                    </tr>
                    <tr>
                       <td class="sheet-ability-name rollable" onclick="app.rollFromSheet('Vontade', parseInt(document.getElementById('sheet-save-will-total').textContent))">
                         Vontade (SAB)
                         ${(char.specialAbilities || []).includes('still_mind') ? '<span style="color:#aa7c11; font-size:0.55rem; display:block; font-weight:normal; line-height:1;">(+2 vs Encantamento)</span>' : ''}
                       </td>
                       <td id="sheet-save-will-total" class="sheet-stat-total" style="font-size:1.1rem;">0</td>
                      <td><input type="number" value="${char.saveWillBase || 0}" data-path="saveWillBase" style="width:50px;"></td>
                      <td id="sheet-save-will-mod" style="text-align:center; font-weight:bold;">0</td>
                      <td><input type="number" value="${char.saveWillMagic || 0}" data-path="saveWillMagic" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveWillMisc || 0}" data-path="saveWillMisc" style="width:50px;"></td>
                      <td><input type="number" value="${char.saveWillTemp || 0}" data-path="saveWillTemp" style="width:50px;"></td>
                    </tr>
                  </tbody>
                </table>
                ${(() => {
                  let immunities = [];
                  if ((char.specialAbilities || []).includes('divine_health')) immunities.push("Saúde Divina (Imunidade a Doenças)");
                  if ((char.specialAbilities || []).includes('aura_of_courage')) immunities.push("Aura de Coragem (Imunidade a Medo, +4 aliados a 3m)");
                  if ((char.specialAbilities || []).includes('diamond_body')) immunities.push("Corpo de Diamante (Imunidade a Venenos)");
                  if ((char.specialAbilities || []).includes('evasion')) immunities.push("Evasão");
                  if ((char.specialAbilities || []).includes('uncanny_dodge')) immunities.push("Esquiva Sobrenatural");
                  if ((char.specialAbilities || []).includes('still_mind')) immunities.push("Mente Pura (+2 vs Encantamento)");
                  
                  if (immunities.length > 0) {
                    return `
                      <div style="margin-top: 8px; padding: 6px 8px; background: rgba(90, 62, 9, 0.05); border: 1px solid rgba(90, 62, 9, 0.15); border-radius: 4px; font-size: 0.7rem; line-height: 1.3;">
                        <strong style="color:var(--accent-gold-dark);">Habilidades Defensivas/Imunidades:</strong><br>
                        <span style="color:#aa7c11; font-weight:bold;">${immunities.join(' | ')}</span>
                      </div>
                    `;
                  }
                  return '';
                })()}
              </div>

              <!-- Armadura Equipada -->
              <div class="sheet-block" style="margin-top: 15px; border: 1px solid rgba(170,124,17,0.3); background: #ffffff; border-radius: 6px; padding: 12px;">
                <div class="sheet-block-title" style="border-bottom: 1px solid rgba(170,124,17,0.25); padding-bottom: 6px; margin-bottom: 10px; display:flex; align-items:center; gap:6px; font-family:var(--font-header); color:#5a3e09; font-size:0.95rem;">
                  🛡️ Armadura Equipada
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${(() => {
                    const hasArmor = !!char.armorName;
                    const hasShield = !!char.shieldName;
                    const hasParts = char.equippedArmorParts && char.equippedArmorParts.length > 0;
                    
                    if (!hasArmor && !hasShield && !hasParts) {
                      return `<div style="font-size:0.8rem; color:#777; font-style:italic; text-align:center; padding:10px;">Nenhum equipamento de proteção ativo.</div>`;
                    }
                    
                    let html = '';
                    
                    if (hasArmor) {
                      const bonus = parseInt(char.acArmor) || 0;
                      const maxDex = char.armorMaxDex !== undefined && char.armorMaxDex !== null && char.armorMaxDex !== "" ? ` | Des. Máx: ${char.armorMaxDex}` : "";
                      const redDex = char.armorDexPenalty !== undefined && char.armorDexPenalty !== null && char.armorDexPenalty !== "" ? ` | Redução DES: -${char.armorDexPenalty}` : "";
                      html += `
                        <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;">
                          <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:bold; font-size:0.85rem; color:#000;"><span style="font-size:0.95rem; margin-right:6px;">👕</span>${char.armorName}</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                              <span style="background:#5a3e09; color:#fff; font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:3px;">+${bonus} CA</span>
                              <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:22px; border-color:#cc3333; color:#cc3333; background:transparent;" onclick="app.clearManualArmor('${char.id}', ${isNewChar})">Desequipar</button>
                            </div>
                          </div>
                          <div style="font-size:0.72rem; color:#555;">
                            Manual${maxDex}${redDex}
                          </div>
                        </div>
                      `;
                    }
                    
                    if (hasShield) {
                      const bonus = parseInt(char.acShield) || 0;
                      const redDex = char.shieldDexPenalty !== undefined && char.shieldDexPenalty !== null && char.shieldDexPenalty !== "" ? ` | Redução DES: -${char.shieldDexPenalty}` : "";
                      html += `
                        <div style="background: rgba(0,0,0,0.02); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px;">
                          <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:bold; font-size:0.85rem; color:#000;"><span style="font-size:0.95rem; margin-right:6px;">🛡️</span>${char.shieldName}</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                              <span style="background:#5a3e09; color:#fff; font-size:0.75rem; font-weight:bold; padding:2px 6px; border-radius:3px;">+${bonus} CA</span>
                              <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:22px; border-color:#cc3333; color:#cc3333; background:transparent;" onclick="app.clearManualShield('${char.id}', ${isNewChar})">Desequipar</button>
                            </div>
                          </div>
                          <div style="font-size:0.72rem; color:#555;">
                            Manual${redDex}
                          </div>
                        </div>
                      `;
                    }

                    if (hasParts) {
                      html += `
                        <div style="border-top: 1px dashed rgba(170,124,17,0.2); padding-top: 8px; margin-top: 4px;">
                          <div style="font-size: 0.72rem; font-weight: bold; color: #5a3e09; text-transform: uppercase; margin-bottom: 6px;">Peças Modulares Equipadas</div>
                          <div style="display:flex; flex-direction:column; gap:5px;">
                            ${char.equippedArmorParts.map((p, pIdx) => {
                              const bonusVal = parseInt(p.acBonus) || 0;
                              const weightVal = parseFloat(p.weight) || 0;
                              let partMods = [];
                              if (p.attrMods) {
                                for (let key in p.attrMods) {
                                  partMods.push(`${key.toUpperCase()} ${p.attrMods[key] > 0 ? '+' + p.attrMods[key] : p.attrMods[key]}`);
                                }
                              }
                              const partModsStr = partMods.length > 0 ? ` | ${partMods.join(', ')}` : '';
                              return `
                                <div style="background: rgba(0,0,0,0.01); border: 1px solid rgba(170,124,17,0.1); border-radius: 3px; padding: 6px 8px; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                                  <div style="display:flex; flex-direction:column; gap:1px; width: 70%;">
                                    <span><strong style="color:#5a3e09; font-size:0.7rem;">[${p.partType}]</strong> <strong style="color:#000;">${p.name}</strong></span>
                                    <span style="font-size:0.65rem; color:#555;">Bônus CA: +${bonusVal} | ${weightVal} kg${partModsStr}</span>
                                  </div>
                                  <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-weight:bold; color:#000;">+${bonusVal} CA</span>
                                    <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:22px; border-color:#cc3333; color:#cc3333; background:transparent;" onclick="app.removeArmorPart('${char.id}', ${pIdx}, ${isNewChar})">Desequipar</button>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>
                      `;
                    }
                    
                    return html;
                  })()}
                </div>
              </div>

              <div class="sheet-block" style="border: 1px solid rgba(170,124,17,0.3); background: #ffffff; border-radius: 6px; padding: 12px; margin-top: 15px;">
                <div class="sheet-block-title" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(170,124,17,0.2); padding-bottom: 6px; margin-bottom: 10px;">
                  <span style="display:flex; align-items:center; gap:6px; font-family:var(--font-header); color:#5a3e09; font-weight:bold; font-size:0.95rem;">🛡️ pesquisar armas e armaduras</span>
                  <span style="font-size:0.7rem; color:#777; font-weight:normal;">Auto-recalcula</span>
                </div>
                
                <!-- Search input and Selector -->
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <input type="text" id="sheet-armor-search" placeholder="🔍 Pesquisar peça por nome..." class="rpg-input" oninput="app.filterModularArmorSelect('${char.id}', ${isNewChar})" style="width:100%; height:30px; font-size:0.8rem; background:rgba(255,255,255,0.9); color:#000 !important; border:1px solid rgba(170,124,17,0.3); border-radius:4px; box-sizing:border-box; padding:4px 8px;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <select id="sheet-armor-part-select" class="rpg-select" style="flex:1; font-size:0.8rem; height:32px; background:#fff; border-color:var(--accent-gold-dark); color:#000 !important;">
                      <option value="">-- Escolher Peça de Armadura/Escudo/Arma --</option>
                      ${Object.keys(window.DND3_ModularArmorParts || {})
                        .filter(k => !(char.equippedArmorParts || []).some(ep => ep.key === k))
                        .map(k => {
                          const p = window.DND3_ModularArmorParts[k];
                          let attrText = "";
                          if (p.attrMods) {
                            const mods = Object.keys(p.attrMods).map(a => `${a.toUpperCase()} ${p.attrMods[a] > 0 ? '+' + p.attrMods[a] : p.attrMods[a]}`);
                            attrText = ` | Mod: ${mods.join(', ')}`;
                          }
                          let specsText = "";
                          if (p.partType === 'Arma') {
                            specsText = `Dano ${p.damageBase || '1d6'}${p.attack ? ', Atk ' + p.attack : ''}`;
                          } else {
                            specsText = `CA +${p.acBonus || 0}${p.penalty ? ', Pen ' + p.penalty : ''}`;
                          }
                          return `<option value="${k}">[${p.partType}] ${p.name} (${specsText}${attrText})</option>`;
                        }).join('')}
                    </select>
                    <button class="rpg-btn" style="padding:0 15px; font-size:0.8rem; height:32px; background:#5a3e09; color:#fdfaf2; border-color:#5a3e09; margin:0;" onclick="app.addArmorPart('${char.id}', ${isNewChar})">Equipar</button>
                  </div>
                </div>
              </div>

              <!-- Bônus de Ataque (Compactado para a Primeira Coluna) -->
              <div class="sheet-block" style="margin-top: 15px;">
                <div class="sheet-block-title">Bônus de Ataque</div>
                <div class="sheet-bba-table-container" style="overflow-x: auto; width: 100%;">
                  <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.75rem;">
                    <thead>
                      <tr style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; border-bottom:1px solid rgba(170,124,17,0.2);">
                        <th style="text-align: left; padding: 2px;">Tipo</th>
                        <th style="padding: 2px;">Total</th>
                        <th style="padding: 2px;"></th>
                        <th style="padding: 2px;">BBA</th>
                        <th style="padding: 2px;"></th>
                        <th style="padding: 2px;">Mod. Atr.</th>
                        <th style="padding: 2px;"></th>
                        <th style="padding: 2px;">Mod. Tam.</th>
                        <th style="padding: 2px;"></th>
                        <th style="padding: 2px;">Mod. Var.</th>
                        <th style="padding: 2px;"></th>
                        <th style="padding: 2px;">Mod. Temp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- CORPO A CORPO -->
                      <tr class="rollable-row" style="height: 48px;" onclick="if(event.target.tagName !== 'INPUT') app.rollFromSheet('Ataque Corpo a Corpo', parseInt(document.getElementById('sheet-melee-total').textContent))">
                        <td style="text-align: left; font-weight: bold; font-family: var(--font-header); color: var(--accent-gold); padding: 2px; font-size:0.75rem;">
                          C. a C.
                        </td>
                        <td style="padding: 2px;">
                          <span id="sheet-melee-total" class="sheet-stat-total" style="font-size: 1.15rem; min-width: 32px; display: inline-block;">0</span>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">=</td>
                        <td style="padding: 2px;">
                          <span id="sheet-melee-bab" style="font-weight: bold; font-size: 0.95rem;">0</span>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <span id="sheet-melee-str" style="font-weight: bold; font-size: 0.95rem; color: #8b0000;">0</span>
                          <div style="font-size: 0.55rem; color: #777; font-weight:normal;">FOR</div>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <span id="sheet-melee-size" style="font-weight: bold; font-size: 0.95rem;">0</span>
                          <div style="font-size: 0.55rem; color: #777; font-weight:normal;">TAM</div>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <input type="number" value="${char.meleeMisc || 0}" data-path="meleeMisc" style="width: 35px; height:24px; text-align: center; font-size: 0.8rem; font-weight: bold; padding:2px;">
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <input type="number" value="${char.meleeTemp || 0}" data-path="meleeTemp" style="width: 35px; height:24px; text-align: center; font-size: 0.8rem; font-weight: bold; background: rgba(0,0,0,0.05); padding:2px;">
                        </td>
                      </tr>
                      
                      <!-- DISTÂNCIA -->
                      <tr class="rollable-row" style="height: 48px;" onclick="if(event.target.tagName !== 'INPUT') app.rollFromSheet('Ataque à Distância', parseInt(document.getElementById('sheet-ranged-total').textContent))">
                        <td style="text-align: left; font-weight: bold; font-family: var(--font-header); color: var(--accent-gold); padding: 2px; font-size:0.75rem;">
                          Dist.
                        </td>
                        <td style="padding: 2px;">
                          <span id="sheet-ranged-total" class="sheet-stat-total" style="font-size: 1.15rem; min-width: 32px; display: inline-block;">0</span>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">=</td>
                        <td style="padding: 2px;">
                          <span id="sheet-ranged-bab" style="font-weight: bold; font-size: 0.95rem;">0</span>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <span id="sheet-ranged-dex" style="font-weight: bold; font-size: 0.95rem; color: #00008b;">0</span>
                          <div style="font-size: 0.55rem; color: #777; font-weight:normal;">DES</div>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <span id="sheet-ranged-size" style="font-weight: bold; font-size: 0.95rem;">0</span>
                          <div style="font-size: 0.55rem; color: #777; font-weight:normal;">TAM</div>
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <input type="number" value="${char.rangedMisc || 0}" data-path="rangedMisc" style="width: 35px; height:24px; text-align: center; font-size: 0.8rem; font-weight: bold; padding:2px;">
                        </td>
                        <td style="font-weight: bold; font-size: 1rem; color: var(--accent-gold); padding:0 1px;">+</td>
                        <td style="padding: 2px;">
                          <input type="number" value="${char.rangedTemp || 0}" data-path="rangedTemp" style="width: 35px; height:24px; text-align: center; font-size: 0.8rem; font-weight: bold; background: rgba(0,0,0,0.05); padding:2px;">
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  ${(() => {
                    let attackNotes = [];
                    if ((char.specialAbilities || []).includes('sneak_attack')) {
                      const sneakDice = Math.floor(((char.level || 1) + 1) / 2);
                      attackNotes.push(`<strong>Ataque Furtivo:</strong> +${sneakDice}d6 de dano de precisão`);
                    }
                    if ((char.specialAbilities || []).includes('wild_empathy')) {
                      const derived = this.calculateDerivedStats(char);
                      const chaMod = derived.mods?.cha || 0;
                      const bonus = (char.level || 1) + chaMod;
                      attackNotes.push(`<strong>Empatia Selvagem:</strong> 1d20 + ${bonus}`);
                    }
                    if ((char.specialAbilities || []).includes('track')) {
                      attackNotes.push(`<strong>Rastrear:</strong> Pode seguir pegadas usando Conhecimento de Ermos`);
                    }
                    if (attackNotes.length > 0) {
                      return `
                        <div style="margin-top: 8px; padding: 6px; background: rgba(170, 124, 17, 0.05); border: 1px dashed rgba(170, 124, 17, 0.3); border-radius: var(--radius-md); font-size: 0.72rem; display: flex; flex-direction: column; gap: 3px;">
                          ${attackNotes.map(n => `<div style="line-height:1.25; color:#5a3e09;">${n}</div>`).join('')}
                        </div>
                      `;
                    }
                    return '';
                  })()}
                </div>
              </div>
            </div>

            <!-- HP, AC and Combat Column -->
            <div>
              <div class="sheet-block" style="display:flex; flex-direction:column; gap:12px; align-items:center; justify-content:center;">
                <!-- PV Total e PV Atual lado a lado -->
                <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: center;">
                  <div style="display:flex; flex-direction:column; align-items:center;">
                    <label style="font-weight:bold; font-size:0.75rem; color:#8b0000; text-transform:uppercase; margin-bottom: 4px;">PV Total (Máx)</label>
                    <input type="number" id="sheet-hp-max" value="${char.hpMax || 10}" data-path="hpMax" inputmode="numeric" min="1" style="font-size:1.3rem; text-align:center; font-weight:bold; color:#8b0000 !important; border:2px solid #8b0000 !important; background:#ffffff !important; width:100%; max-width:105px; height:38px; border-radius:4px; box-sizing:border-box;" title="PV Total do personagem (Livre para alteração manual).">
                  </div>
                  <div style="display:flex; flex-direction:column; align-items:center;">
                    <label style="font-weight:bold; font-size:0.75rem; color:#2d6a4f; text-transform:uppercase; margin-bottom: 4px;">PV Atual</label>
                    <input type="number" id="sheet-hp-current" value="${char.currentHp !== undefined ? char.currentHp : (char.hpMax || 10)}" data-path="currentHp" inputmode="numeric" style="font-size:1.3rem; text-align:center; font-weight:bold; color:#2d6a4f !important; border:2px solid #2d6a4f !important; background:#ffffff !important; width:100%; max-width:105px; height:38px; border-radius:4px; box-sizing:border-box;" title="PV Atual (Vida restante).">
                  </div>
                </div>

                <!-- Campo de Dados Rolados e Reset -->
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; border-top: 1px dashed rgba(170,124,17,0.2); padding-top: 8px;">
                  <label style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold;">Adicionar PV Rolado</label>
                  <input type="number" id="sheet-hp-rolled-input" placeholder="Dado extra..." style="font-size:1rem; text-align:center; padding: 2px; width: 100%; max-width: 220px; height:32px; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; color:#000;">
                  <div style="display:flex; gap:6px; width:100%; max-width:220px;">
                    <button class="rpg-btn" style="flex:1; height: 34px; font-size: 0.85rem; font-weight: bold; background: #8b0000 !important; color: #fff !important; border: 1px solid #8b0000 !important; border-radius: 4px; margin: 0; box-shadow: 0 2px 5px rgba(139,0,0,0.25);" onclick="app.addHpRolled('${char.id}', ${isNewChar})" title="Soma dado rolado ao PV Total">Somar 🎲</button>
                    <button class="rpg-btn rpg-btn-secondary" style="height: 34px; font-size: 0.75rem; padding: 0 8px; margin: 0;" onclick="app.resetHpToStandard('${char.id}', ${isNewChar})" title="Recalcular PV estritamente pela média oficial de D&D 3.0 para todas as classes">Média Oficial ↺</button>
                  </div>
                  <!-- Inputs invisíveis para compatibilidade retroativa com JavaScript da página -->
                  <input type="hidden" id="sheet-hp-automatic" value="${char.hpMax || 10}">
                  <span id="sheet-hp-rolled-accumulated" style="font-size:0.7rem; color:var(--text-muted); ${char.hpRolled > 0 ? '' : 'display:none;'}">+${char.hpRolled || 0} PV extras rolados</span>
                </div>
              </div>

              <div class="sheet-block">
                <div class="sheet-block-title rollable" onclick="app.rollFromSheet('Iniciativa', parseInt(document.getElementById('sheet-init-total').textContent))">Iniciativa</div>
                <div class="sheet-calc-box" style="margin-bottom: 10px;">
                  <span id="sheet-init-total" class="sheet-stat-total" style="font-size:1.4rem; min-width:50px;">0</span>
                  <span class="sheet-calc-equals">=</span>
                  <div style="text-align:center; width: 60px;">
                    <span id="sheet-init-dex" style="font-weight:bold;">0</span>
                    <div style="font-size:0.65rem; color:#777;">MOD DES</div>
                  </div>
                  <span style="font-weight:bold;">+</span>
                  <div style="text-align:center; width: 80px;">
                    <span id="sheet-init-misc-total" style="font-weight:bold;">0</span>
                    <div style="font-size:0.65rem; color:#777;">OUTROS MODS</div>
                  </div>
                </div>
                
                <div class="init-mods-container" style="display:flex; flex-direction:column; gap:6px; border-top: 1px solid rgba(212,175,55,0.15); padding-top: 8px;">
                  <div style="font-size:0.7rem; font-weight:bold; color:var(--accent-gold); text-transform:uppercase; margin-bottom:4px; text-align:center;">Outros Modificadores de Iniciativa</div>
                  
                  <!-- Form to add initiative mod -->
                  <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                    <input type="text" id="temp-init-desc" placeholder="Ex: Iniciativa Aprimorada" style="flex:1; font-size:0.8rem; height:28px; background:#fff; color:#000;">
                    <input type="number" id="temp-init-val" placeholder="+4" style="width:50px; text-align:center; font-size:0.8rem; height:28px; background:#fff; color:#000;">
                    <button class="rpg-btn" style="padding:0 8px; font-size:0.75rem; height:28px; margin:0;" onclick="app.addInitiativeMod('${char.id}', ${isNewChar})">Add</button>
                  </div>

                  <!-- List of mods -->
                  <div style="display:flex; flex-direction:column; gap:4px; max-height:100px; overflow-y:auto; width:100%;">
                    ${(char.initiativeMods || []).length === 0 ? `
                      <div style="font-size:0.7rem; color:var(--text-muted); font-style:italic; text-align:center; padding:4px;">Nenhum modificador extra.</div>
                    ` : (char.initiativeMods || []).map((mod, idx) => `
                      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; background:rgba(255,255,255,0.03); border:1px solid rgba(170,124,17,0.15); border-radius:3px; padding:3px 8px; box-sizing:border-box; width:100%;">
                        <span><strong>${mod.val >= 0 ? '+' : ''}${mod.val}</strong>: ${mod.desc || 'Outros'}</span>
                        <button class="rpg-btn" style="padding:1px 5px; font-size:0.65rem; border-color:#ff4444; color:#ff4444; background:transparent; margin:0;" onclick="app.deleteInitiativeMod('${char.id}', ${idx}, ${isNewChar})">❌</button>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              <div class="sheet-block">
                <div class="sheet-block-title">Classe de Armadura (CA)</div>
                <div class="ac-calc-container" style="display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:12px; font-family:'Cinzel', serif;">
                  <div style="text-align:center;">
                    <div id="sheet-ac-total" class="sheet-stat-total" style="font-size:1.4rem; min-width:48px; height:34px; display:inline-flex; align-items:center; justify-content:center; border:2px solid #5a3e09; border-radius:4px; font-weight:bold; background:#fdfaf2; color:#000; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">10</div>
                    <span style="font-size:0.6rem; font-weight:bold; display:block; margin-top:2px;">TOTAL</span>
                  </div>
                  <span class="sheet-calc-equals" style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">=</span>
                  <div style="text-align:center;">
                    <div style="font-size:1.2rem; font-weight:bold; min-width:34px; height:34px; display:inline-flex; align-items:center; justify-content:center; border:2px solid #ccc; border-radius:4px; background:#fff; color:#000; font-family:'Inter', sans-serif;">10</div>
                    <span style="font-size:0.6rem; color:#777; display:block; margin-top:2px;">BASE</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <span id="sheet-ac-armor" style="font-weight:bold; display:inline-flex; align-items:center; justify-content:center; border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; background:#fff; color:#000; font-family:'Inter', sans-serif;">${char.acArmor || 0}</span>
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">ARMADURA</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <span id="sheet-ac-shield" style="font-weight:bold; display:inline-flex; align-items:center; justify-content:center; border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; background:#fff; color:#000; font-family:'Inter', sans-serif;">${char.acShield || 0}</span>
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">ESCUDO</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <span id="sheet-ac-dex" style="font-weight:bold; display:inline-flex; align-items:center; justify-content:center; border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; background:#fff; color:#000; font-family:'Inter', sans-serif;">0</span>
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">MOD. DES</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <input type="number" value="${char.acSize || 0}" data-path="acSize" disabled style="background:rgba(0,0,0,0.05); font-weight:bold; border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; text-align:center; font-size:1.05rem; color:#000; box-sizing:border-box; font-family:'Inter', sans-serif;">
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">MOD. TAM.</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <input type="number" value="${char.acNatural || 0}" data-path="acNatural" style="border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; text-align:center; font-size:1.05rem; font-weight:bold; background:#fff; color:#000; box-sizing:border-box; font-family:'Inter', sans-serif;">
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">ARM. NAT.</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <input type="number" value="${char.acDeflection || 0}" data-path="acDeflection" style="border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; text-align:center; font-size:1.05rem; font-weight:bold; background:#fff; color:#000; box-sizing:border-box; font-family:'Inter', sans-serif;">
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">DEFLEXÃO</span>
                  </div>
                  <span style="font-weight:bold; font-size:1.2rem; color:var(--accent-gold);">+</span>
                  <div style="text-align:center; width:45px;">
                    <input type="number" value="${char.acMisc || 0}" data-path="acMisc" style="border:2px solid #5a3e09; border-radius:4px; width:34px; height:34px; text-align:center; font-size:1.05rem; font-weight:bold; background:#fff; color:#000; box-sizing:border-box; font-family:'Inter', sans-serif;">
                    <span style="font-size:0.5rem; color:#777; display:block; margin-top:2px; letter-spacing:-0.05em; font-family:'Inter', sans-serif;">MOD. VAR.</span>
                  </div>
                </div>
                <div style="display:flex; justify-content:space-around; border-top:1px solid rgba(170,124,17,0.2); padding-top:8px; font-size:0.85rem;">
                  <div><strong>CA Toque:</strong> <span id="sheet-ac-touch" style="font-weight:bold; color:#8b0000;">10</span></div>
                  <div><strong>CA Surpreso:</strong> <span id="sheet-ac-flat" style="font-weight:bold; color:#8b0000;">10</span></div>
                </div>
              </div>

              <!-- Novo Bloco de Armadura e Escudo -->
              <div class="sheet-block">
                <div class="sheet-block-title">Armadura e Escudo</div>
                <div style="display:flex; flex-direction:column; gap:8px; font-size: 0.8rem; width: 100%;">
                  <!-- Armadura -->
                  <div style="display:flex; flex-direction:column; gap:4px; width: 100%;">
                    <input type="text" value="${char.armorName || ''}" data-path="armorName" placeholder="Nome da Armadura" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000;">
                    <div class="armor-shield-manual-row" style="display:flex; gap:6px; align-items:center; justify-content:space-between; width:100%;">
                      <div style="display:flex; align-items:center; gap:2px;">
                        <span style="font-size:0.65rem; font-weight:bold; color:#5a3e09; white-space:nowrap;">CA:</span>
                        <input type="number" value="${char.acArmor || 0}" data-path="acArmor" style="text-align:center; font-weight:bold; height:26px; width:35px; font-size:0.75rem; padding:2px; background:#fff; color:#000;">
                      </div>
                      <div style="display:flex; align-items:center; gap:2px;">
                        <span style="font-size:0.65rem; font-weight:bold; color:#5a3e09; white-space:nowrap;">Des Max:</span>
                        <input type="number" value="${char.armorMaxDex !== undefined ? char.armorMaxDex : ''}" data-path="armorMaxDex" placeholder="--" style="text-align:center; height:26px; width:35px; font-size:0.75rem; padding:2px; background:#fff; color:#000;">
                      </div>
                      <div style="display:flex; align-items:center; gap:2px;">
                        <span style="font-size:0.65rem; font-weight:bold; color:#ff6666; white-space:nowrap;">Redução Des:</span>
                        <input type="number" value="${char.armorDexPenalty !== undefined ? char.armorDexPenalty : ''}" data-path="armorDexPenalty" placeholder="--" style="text-align:center; color:#ff6666; font-weight:bold; height:26px; width:35px; font-size:0.75rem; padding:2px; background:#fff; color:#000;">
                      </div>
                      <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; height:26px; margin:0;" onclick="app.addManualArmorToInventory('${char.id}', ${isNewChar})">Adicionar</button>
                    </div>
                  </div>
                  <!-- Escudo -->
                  <div style="display:flex; flex-direction:column; gap:4px; border-top:1px dashed rgba(170,124,17,0.2); padding-top:6px; width: 100%;">
                    <input type="text" value="${char.shieldName || ''}" data-path="shieldName" placeholder="Nome do Escudo" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000;">
                    <div class="armor-shield-manual-row" style="display:flex; gap:6px; align-items:center; justify-content:space-between; width:100%;">
                      <div style="display:flex; align-items:center; gap:2px;">
                        <span style="font-size:0.65rem; font-weight:bold; color:#5a3e09; white-space:nowrap;">CA:</span>
                        <input type="number" value="${char.acShield || 0}" data-path="acShield" style="text-align:center; font-weight:bold; height:26px; width:35px; font-size:0.75rem; padding:2px; background:#fff; color:#000;">
                      </div>
                      <div style="display:flex; align-items:center; gap:2px;">
                        <span style="font-size:0.65rem; font-weight:bold; color:#ff6666; white-space:nowrap;">Redução Des:</span>
                        <input type="number" value="${char.shieldDexPenalty !== undefined ? char.shieldDexPenalty : ''}" data-path="shieldDexPenalty" placeholder="--" style="text-align:center; color:#ff6666; font-weight:bold; height:26px; width:35px; font-size:0.75rem; padding:2px; background:#fff; color:#000;">
                      </div>
                      <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; height:26px; margin:0;" onclick="app.addManualShieldToInventory('${char.id}', ${isNewChar})">Adicionar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Weapons block -->
          <div class="sheet-block" style="margin-top:20px;">
            <div style="border-bottom:1px solid rgba(170,124,17,0.2); padding-bottom:6px; margin-bottom:12px;">
              <span style="font-family:var(--font-header); color:#5a3e09; font-weight:bold; font-size:1.1rem; letter-spacing:0.02em;">Inventário de Armas</span>
            </div>
            
            ${(() => {
              const attackOptions = [];
              for (let i = 30; i >= 0; i--) attackOptions.push(`+${i}`);
              for (let i = -1; i >= -5; i--) attackOptions.push(`${i}`);

              const damageBaseOptions = ['1d2', '1d3', '1d4', '1d6', '1d8', '1d10', '1d12', '2d4', '2d6', '2d8', '2d10'];

              const damageModOptions = [];
              for (let i = 20; i >= 0; i--) damageModOptions.push(`+${i}`);
              for (let i = -1; i >= -5; i--) damageModOptions.push(`${i}`);

              const criticalOptions = ['x2', 'x3', 'x4', '19-20/x2', '19-20/x3', '18-20/x2', '20/x2', '20/x3', '20/x4'];

              const rangeOptions = ['Corpo-a-corpo'];
              for (let r = 0.5; r <= 120; r += 0.5) {
                rangeOptions.push(`${r.toFixed(1).replace('.', ',')} m`);
              }

              const typeOptions = ['Cortante', 'Contusivo', 'Perfurante', 'Mágico'];

              return `
                <!-- Form de Preenchimento -->
                <div class="sheet-weapon-box" style="border: 1px solid rgba(170,124,17,0.35); padding: 12px; border-radius: 6px; background: rgba(170,124,17,0.02); margin-bottom: 20px; box-sizing: border-box; width: 100%;">
                  <div style="font-size:0.75rem; font-weight:bold; color:#5a3e09; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.05em; text-align:center;">Preencher Nova Arma / Equipamento de Ataque</div>
                  
                  <div style="margin-bottom:8px;">
                    <label style="font-size:0.7rem; font-weight:bold; display:block; margin-bottom:2px; text-align:left;">Nome do Equipamento</label>
                    <input type="text" id="temp-weapon-name" placeholder="Ex: Espada Longa Obra-Prima" style="width:100%; height:32px; font-size:0.85rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; box-sizing:border-box; padding:4px 8px; background:#fff; color:#000;">
                  </div>
                  
                  <div class="sheet-weapon-grid" style="grid-template-columns: 1fr 1.2fr 1fr 1.2fr 1.2fr 1.2fr; gap:6px; margin-bottom:8px;">
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Bônus Ataque</label>
                      <select id="temp-weapon-attack" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${attackOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Dado Dano</label>
                      <select id="temp-weapon-damageBase" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${damageBaseOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Mod. Dano</label>
                      <select id="temp-weapon-damageMod" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${damageModOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Decisivo</label>
                      <select id="temp-weapon-critical" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${criticalOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Alcance</label>
                      <select id="temp-weapon-range" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${rangeOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                    <div>
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:left;">Tipo</label>
                      <select id="temp-weapon-type" style="width:100%; height:32px; font-size:0.8rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; background:#fff; box-sizing:border-box;">
                        <option value="">--</option>
                        ${typeOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  
                  <div style="display:flex; flex-direction:column; gap:8px;">
                    <div>
                      <label style="font-size:0.7rem; font-weight:bold; display:block; margin-bottom:2px; text-align:left;">Notas / Munição / Descrição</label>
                      <input type="text" id="temp-weapon-notes" placeholder="Notas adicionais ou munição..." style="width:100%; height:32px; font-size:0.85rem; border:1px solid rgba(170,124,17,0.3); border-radius:4px; box-sizing:border-box; padding:4px 8px; background:#fff; color:#000;">
                    </div>
                    <button class="rpg-btn" style="width:100%; height:38px; font-size:0.85rem; font-weight:bold; background:#5a3e09; color:#fdfaf2; border-color:#5a3e09; margin:4px 0 0 0;" onclick="app.addTempWeaponToList('${char.id}', ${isNewChar})">
                      Adicionar Arma ao Inventário ⚔️
                    </button>
                  </div>
                </div>

                <!-- Lista de Armas Equipadas -->
                <div style="display:flex; flex-direction:column; gap:8px; width: 100%;">
                  <div style="font-size:0.75rem; font-weight:bold; color:var(--accent-gold-dark); text-transform:uppercase; margin-bottom:4px; text-align:center;">Armas Adicionadas</div>
                  ${(char.weapons || []).length === 0 ? `
                    <div style="font-size:0.8rem; color:var(--text-muted); font-style:italic; text-align:center; padding:15px; border:1px dashed rgba(170,124,17,0.2); border-radius:4px;">Nenhuma arma no inventário. Preencha o formulário acima para adicionar!</div>
                  ` : (char.weapons || []).map((w, idx) => {
                    const deityAtk = app.getWeaponDeityAttackBonus(char, w.name);
                    const deityDmg = app.getWeaponDeityDamageBonus(char, w.name);
                    const totalAtk = (parseInt(w.attack) || 0) + deityAtk;
                    const totalAtkStr = totalAtk >= 0 ? `+${totalAtk}` : totalAtk;
                    const dmgModStr = w.damageMod ? (parseInt(w.damageMod) >= 0 ? `+${w.damageMod}` : w.damageMod) : '';
                    const deityDmgStr = deityDmg > 0 ? ` +${deityDmg} (deus)` : '';
                    return `
                      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(170,124,17,0.25); border-radius:4px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px; text-align:left; box-sizing:border-box; width:100%;">
                        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;">
                          <div style="font-weight:bold; color:#5a3e09; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${w.name || 'Arma sem nome'}
                          </div>
                          <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.25;">
                            Ataque: <strong style="color:var(--accent-gold); font-size:0.76rem;">${totalAtkStr}</strong> |
                            Dano: <strong>${w.damageBase || '1d6'}${dmgModStr}${deityDmgStr}</strong> |
                            Crítico: <strong>${w.critical || 'x2'}</strong> |
                            Alcance: <strong>${w.range || 'Corpo-a-corpo'}</strong> |
                            Tipo: <strong>${w.type || 'Cortante'}</strong>
                            ${w.notes ? `<div style="font-style:italic; color:#777; margin-top:2px;">Nota: ${w.notes}</div>` : ''}
                          </div>
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
                          <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; border-color:#aa7c11; margin:0;" onclick="app.rollFromSheet('Ataque com ${w.name.replace(/'/g, "\\'")}', ${totalAtk})">Rolar Ataque 🎲</button>
                          <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; border-color:#ff4444; color:#ff4444; background:transparent; margin:0;" onclick="app.deleteWeaponFromInventory('${char.id}', ${idx}, ${isNewChar})">Excluir</button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            })()}
          </div>
        </div>

        <!-- PAGE 2: PERÍCIAS & TALENTOS -->
        <div class="sheet-sub-tab-content" id="sheet-sec-page2" style="display: ${activeSubtab === 'page2' ? 'block' : 'none'};">
          <div class="sheet-grid-2">
            <!-- Skills Table -->
            <div class="sheet-block" style="background:rgba(255,255,255,0.5);">
              <div class="sheet-block-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span>Perícias (Clique para Rolar)</span>
                <span style="font-size:0.8rem; color:#5a3e09; font-weight:bold;" id="sheet-skill-points-counter-display">Pontos: ${this.calculateSpentSkillPoints(char)} / ${this.calculateMaxSkillPoints(char)}</span>
              </div>
              <div style="overflow-x:auto; width:100%; -webkit-overflow-scrolling:touch;">
                <table class="sheet-table">
                  <thead>
                    <tr>
                      <th style="text-align:center; width:25px;">⭐</th>
                      <th style="text-align:left;">Perícia</th>
                      <th class="hide-mobile">Atr</th>
                      <th>Total</th>
                      <th class="hide-mobile">Atr</th>
                      <th>Grad.</th>
                      <th>Outros</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.keys(window.DND3_Skills).sort((a,b) => window.DND3_Skills[a].name.localeCompare(window.DND3_Skills[b].name)).map(k => {
                      const sk = window.DND3_Skills[k];
                      const ranks = char.skillRanks[k] || 0;
                      const manualMisc = char.skillMisc[k] || 0;
                      const racialBonus = (window.DND3_RacialSkillBonuses && window.DND3_RacialSkillBonuses[char.race] && window.DND3_RacialSkillBonuses[char.race][k]) ? window.DND3_RacialSkillBonuses[char.race][k] : 0;
                      const misc = manualMisc + racialBonus;
                      const isChosen = !!(char.chosenSkills && char.chosenSkills[k]);
                      
                      // Calculate active ability score & mod
                      const stats = this.calculateDerivedStats(char);
                      const abilityMod = stats.mods[sk.keyAbility] || 0;
                      const totalMod = abilityMod + ranks + misc;
                      const isClass = this.isClassSkill(char, k);
                      
                      return `
                        <tr class="rollable-row" onclick="if(event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON' && !event.target.closest('button')) app.rollFromSheet('Teste de ${sk.name}', ${totalMod})">
                          <td style="text-align:center;">
                            <input type="checkbox" ${isChosen ? 'checked' : ''} onclick="app.toggleChosenSkill('${char.id}', '${k}', ${isNewChar})" title="Marcar como perícia favorita / escolhida" style="cursor:pointer; width:16px; height:16px; margin:0 auto; display:block;">
                          </td>
                          <td class="sheet-ability-name" style="text-align:left; white-space:normal; min-width:100px; font-size:0.8rem; line-height:1.25; padding: 4px 6px;">
                            ${sk.name} ${isClass ? '<span style="color:#228b22; font-size:0.65rem; font-weight:bold;">(C)</span>' : ''}
                            <span style="font-size:0.65rem; color:#777; font-weight:normal;">(${sk.keyAbility.toUpperCase()})</span>
                          </td>
                          <td class="hide-mobile" style="text-align:center; text-transform:uppercase; font-size:0.75rem;">${sk.keyAbility}</td>
                          <td id="sheet-skill-total-${k}" class="sheet-stat-total" style="font-size:0.95rem; text-align:center; font-weight:bold; color:#8b0000; padding: 4px 6px;">
                            ${totalMod >= 0 ? '+' + totalMod : totalMod}
                          </td>
                          <td class="hide-mobile" id="sheet-skill-mod-${k}" style="text-align:center; font-weight:bold; padding: 4px 6px;">
                            ${abilityMod >= 0 ? '+' + abilityMod : abilityMod}
                          </td>
                          <td style="text-align:center; min-width:75px; padding: 4px 6px;">
                            <div style="display:inline-flex; align-items:center; gap:2px; justify-content:center; width:100%;">
                              <button type="button" class="rpg-btn" style="padding:1px 3px; font-size:0.7rem; height:22px; min-width:18px; margin:0; line-height:1;" onclick="app.adjustSkillRank('${char.id}', '${k}', -1, ${isNewChar})">-</button>
                              <input type="number" min="0" max="99" value="${ranks}" data-path="skillRanks.${k}" style="width:36px; text-align:center; padding: 2px; font-size:0.85rem; font-weight:bold; height:22px; box-sizing:border-box;">
                              <button type="button" class="rpg-btn" style="padding:1px 3px; font-size:0.7rem; height:22px; min-width:18px; margin:0; line-height:1;" onclick="app.adjustSkillRank('${char.id}', '${k}', 1, ${isNewChar})">+</button>
                            </div>
                          </td>
                          <td style="text-align:center; padding: 4px 6px;">
                            <input type="number" value="${misc}" data-path="skillMisc.${k}" title="${racialBonus > 0 ? `Inclui +${racialBonus} de bônus racial` : 'Modificador Variado'}" style="width:35px; text-align:center; padding: 2px; font-size:0.8rem; height:22px; box-sizing:border-box; ${racialBonus > 0 ? 'border-color:var(--accent-gold); font-weight:bold;' : ''}">
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Feats and Languages -->
            <div>
              <div class="sheet-block">
                <div class="sheet-block-title">Talentos de classe</div>
                
                <!-- Adicionar Talentos da Base -->
                <div style="background: rgba(170,124,17,0.05); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 10px; margin-bottom: 15px; width:100%; box-sizing:border-box;">
                  <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Adicionar Talento do Livro:</div>
                  <input type="text" id="sheet-feat-search" placeholder="🔍 Pesquisar talento..." oninput="app.filterSheetFeatsList(this.value, '${char.id}', ${isNewChar})" style="width: 100%; height: 28px; padding: 4px 8px; font-size: 0.8rem; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; background: #fff; color:#000;">
                  
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select id="sheet-feat-select" style="flex: 1; min-width: 150px; height: 28px; font-size: 0.8rem; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; background: #fff; box-sizing: border-box; color:#000;">
                      <option value="">-- Escolha um Talento --</option>
                      ${Object.keys(window.DND3_Feats).map(k => {
                        const feat = window.DND3_Feats[k];
                        const isAlreadyAdded = (char.feats || []).includes(k);
                        return `<option value="${k}" ${isAlreadyAdded ? 'disabled' : ''}>${feat.name} ${isAlreadyAdded ? '(Já Adicionado)' : ''}</option>`;
                      }).join('')}
                    </select>
                    <button class="rpg-btn" style="padding: 0 12px; min-width: 80px; font-size: 0.75rem; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; margin:0;" onclick="app.addFeatFromSheet('${char.id}', ${isNewChar})">Adicionar</button>
                  </div>
                </div>

                <!-- Adicionar Talento Customizado -->
                <div style="background: rgba(170,124,17,0.05); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 10px; margin-bottom: 15px; width:100%; box-sizing:border-box;">
                  <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Criar Talento Personalizado:</div>
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    <input type="text" id="sheet-custom-feat-name" placeholder="Nome do talento (Ex: Foco em Magia Épica)" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px 8px;">
                    <input type="text" id="sheet-custom-feat-benefit" placeholder="Efeito / Benefício do talento" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px 8px;">
                    <button class="rpg-btn" style="width:100%; height:28px; font-size:0.75rem; margin:4px 0 0 0;" onclick="app.addCustomFeat('${char.id}', ${isNewChar})">Adicionar Personalizado</button>
                  </div>
                </div>

                <!-- Lista de Talentos Ativos -->
                <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Talentos Adicionados:</div>
                <div id="sheet-added-feats-list" style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; width:100%;">
                  ${(char.feats || []).length === 0 && (!char.customFeats || char.customFeats.length === 0) ? `
                    <div style="font-size: 0.75rem; color: #777; font-style: italic; text-align: center; padding: 8px;">Nenhum talento selecionado ou criado.</div>
                  ` : ""}
                  
                  <!-- Talentos do Livro -->
                  ${(char.feats || []).map(fKey => {
                    const feat = window.DND3_Feats[fKey];
                    if (!feat) return '';
                    const isActive = !!char.activeFeats?.[fKey];
                    return `
                      <div style="padding: 6px 8px; border: 1px solid rgba(170,124,17,0.25); border-radius: 4px; background: #fff; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align:left; box-sizing:border-box; width:100%; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                          <strong style="color: var(--accent-gold-dark); font-size: 0.8rem; font-family: var(--font-header);">${feat.name}</strong>
                          <div style="font-size: 0.7rem; color: #333; margin-top: 1px; line-height: 1.25;">${feat.benefit}</div>
                        </div>
                        <div style="display: flex; flex-direction: row; gap: 4px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
                          <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: ${isActive ? '#228b22' : '#aa7c11'}; color: ${isActive ? '#228b22' : '#aa7c11'}; background: ${isActive ? 'rgba(34,139,34,0.1)' : 'transparent'}; line-height: 1; min-height: 18px; width: 60px; text-align: center; margin:0;" onclick="app.toggleFeatActive('${char.id}', '${fKey}', ${isNewChar})">
                            ${isActive ? 'Ativo' : 'Ativar'}
                          </button>
                          <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: #ff4444; color: #ff4444; background: transparent; line-height: 1; min-height: 18px; width: 60px; text-align: center; margin:0;" onclick="app.removeFeatFromSheet('${char.id}', '${fKey}', ${isNewChar})">Excluir</button>
                        </div>
                      </div>
                    `;
                  }).join('')}

                  <!-- Talentos Personalizados -->
                  ${(char.customFeats || []).map((feat, idx) => `
                    <div style="padding: 6px 8px; border: 1px solid rgba(170,124,17,0.25); border-radius: 4px; background: #fff; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align:left; box-sizing:border-box; width:100%; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 150px;">
                        <strong style="color: var(--accent-gold-dark); font-size: 0.8rem; font-family: var(--font-header);">${feat.name}</strong>
                        <div style="font-size: 0.7rem; color: #333; margin-top: 1px; line-height: 1.25;">${feat.benefit}</div>
                      </div>
                      <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: #ff4444; color: #ff4444; background: transparent; line-height: 1; min-height: 18px; width: 60px; text-align: center; flex-shrink: 0; margin:0;" onclick="app.deleteCustomFeat('${char.id}', ${idx}, ${isNewChar})">Excluir</button>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="sheet-block">
                <div class="sheet-block-title">Habilidades Especiais de Classe</div>
                
                <!-- Adicionar Habilidades da Base -->
                <div style="background: rgba(170,124,17,0.05); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 10px; margin-bottom: 15px; width:100%; box-sizing:border-box;">
                  <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Adicionar Habilidade Especial:</div>
                  <input type="text" id="sheet-ability-search" placeholder="🔍 Pesquisar habilidade..." oninput="app.filterSheetAbilitiesList(this.value, '${char.id}', ${isNewChar})" style="width: 100%; height: 28px; padding: 4px 8px; font-size: 0.8rem; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; background: #fff; color:#000;">
                  
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select id="sheet-ability-select" style="flex: 1; min-width: 150px; height: 28px; font-size: 0.8rem; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; background: #fff; box-sizing: border-box; color:#000;">
                      <option value="">-- Escolha uma Habilidade --</option>
                      ${Object.keys(window.DND3_SpecialAbilities).map(k => {
                        const ability = window.DND3_SpecialAbilities[k];
                        const isAlreadyAdded = (char.specialAbilities || []).includes(k);
                        return `<option value="${k}" ${isAlreadyAdded ? 'disabled' : ''}>${ability.name} ${isAlreadyAdded ? '(Já Adicionado)' : ''}</option>`;
                      }).join('')}
                    </select>
                    <button class="rpg-btn" style="padding: 0 12px; min-width: 80px; font-size: 0.75rem; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; margin:0;" onclick="app.addAbilityFromSheet('${char.id}', ${isNewChar})">Adicionar</button>
                  </div>
                </div>

                <!-- Adicionar Habilidade Especial Customizada -->
                <div style="background: rgba(170,124,17,0.05); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 10px; margin-bottom: 15px; width:100%; box-sizing:border-box;">
                  <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Criar Habilidade Especial Personalizada:</div>
                  <div style="display:flex; flex-direction:column; gap:6px;">
                    <input type="text" id="sheet-custom-ability-name" placeholder="Nome da habilidade (Ex: Corpo Diamantino)" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px 8px;">
                    <input type="text" id="sheet-custom-ability-benefit" placeholder="Efeito / Funcionamento da habilidade" style="width:100%; height:28px; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px 8px;">
                    <button class="rpg-btn" style="width:100%; height:28px; font-size:0.75rem; margin:4px 0 0 0;" onclick="app.addCustomAbility('${char.id}', ${isNewChar})">Adicionar Personalizada</button>
                  </div>
                </div>

                <!-- Lista de Habilidades Ativas -->
                <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 6px; text-align:center;">Habilidades Ativas:</div>
                <div id="sheet-added-abilities-list" style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto; width:100%;">
                  ${(char.specialAbilities || []).length === 0 && (!char.customAbilities || char.customAbilities.length === 0) ? `
                    <div style="font-size: 0.75rem; color: #777; font-style: italic; text-align: center; padding: 8px;">Nenhuma habilidade adicionada ou criada.</div>
                  ` : ""}

                  <!-- Habilidades do Livro -->
                  ${(char.specialAbilities || []).map(aKey => {
                    const ability = window.DND3_SpecialAbilities[aKey];
                    if (!ability) return '';
                    const isActive = !!char.activeSpecialAbilities?.[aKey];
                    return `
                      <div style="padding: 6px 8px; border: 1px solid rgba(170,124,17,0.25); border-radius: 4px; background: #fff; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align:left; box-sizing:border-box; width:100%; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 150px;">
                          <strong style="color: var(--accent-gold-dark); font-size: 0.8rem; font-family: var(--font-header);">${ability.name}</strong>
                          <div style="font-size: 0.7rem; color: #333; margin-top: 1px; line-height: 1.25;">${ability.benefit}</div>
                        </div>
                        <div style="display: flex; flex-direction: row; gap: 4px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
                          <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: ${isActive ? '#228b22' : '#aa7c11'}; color: ${isActive ? '#228b22' : '#aa7c11'}; background: ${isActive ? 'rgba(34,139,34,0.1)' : 'transparent'}; line-height: 1; min-height: 18px; width: 60px; text-align: center; margin:0;" onclick="app.toggleAbilityActive('${char.id}', '${aKey}', ${isNewChar})">
                            ${isActive ? 'Ativo' : 'Ativar'}
                          </button>
                          <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: #ff4444; color: #ff4444; background: transparent; line-height: 1; min-height: 18px; width: 60px; text-align: center; margin:0;" onclick="app.removeAbilityFromSheet('${char.id}', '${aKey}', ${isNewChar})">Excluir</button>
                        </div>
                      </div>
                    `;
                  }).join('')}

                  <!-- Habilidades Personalizadas -->
                  ${(char.customAbilities || []).map((ability, idx) => `
                    <div style="padding: 6px 8px; border: 1px solid rgba(170,124,17,0.25); border-radius: 4px; background: #fff; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align:left; box-sizing:border-box; width:100%; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 150px;">
                        <strong style="color: var(--accent-gold-dark); font-size: 0.8rem; font-family: var(--font-header);">${ability.name}</strong>
                        <div style="font-size: 0.7rem; color: #333; margin-top: 1px; line-height: 1.25;">${ability.benefit}</div>
                      </div>
                      <button class="rpg-btn" style="padding: 2px 6px; font-size: 0.65rem; border-color: #ff4444; color: #ff4444; background: transparent; line-height: 1; min-height: 18px; width: 60px; text-align: center; flex-shrink: 0; margin:0;" onclick="app.deleteCustomAbility('${char.id}', ${idx}, ${isNewChar})">Excluir</button>
                    </div>
                  `).join('')}
                </div>

                <!-- Custom Habilidades Especiais -->
                <div style="font-size: 0.75rem; font-weight: bold; color: #5a3e09; margin-bottom: 4px; text-align:center;">Outras Notas de Habilidades:</div>
                <textarea data-path="featsText" rows="4" placeholder="Digite outras habilidades especiais customizadas..." style="font-family:'Inter',sans-serif; font-size:0.85rem; line-height:1.4; padding: 6px; border: 1px solid rgba(170,124,17,0.3); border-radius: 4px; background: #fff; color:#000; width: 100%; box-sizing: border-box;">${char.featsText || ''}</textarea>
              </div>
              <div class="sheet-block">
                <div class="sheet-block-title">Idiomas</div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                  <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                    <select id="sheet-add-language-select" style="flex:1; min-width:150px; height:32px; font-size:0.85rem;">
                      <option value="">-- Selecione um idioma --</option>
                      <optgroup label="Idiomas Medievais">
                        <option value="Comum">Comum</option>
                        <option value="Anão">Anão</option>
                        <option value="Élfico">Élfico</option>
                        <option value="Gnomo">Gnomo</option>
                        <option value="Halfling">Halfling</option>
                        <option value="Gigante">Gigante</option>
                        <option value="Orc">Orc</option>
                        <option value="Goblin">Goblin</option>
                        <option value="Dracônico">Dracônico</option>
                        <option value="Gnoll">Gnoll</option>
                      </optgroup>
                      <optgroup label="Idiomas Perdidos">
                        <option value="Abissal">Abissal</option>
                        <option value="Celestial">Celestial</option>
                        <option value="Infernal">Infernal</option>
                        <option value="Dialeto Subterrâneo">Dialeto Subterrâneo</option>
                        <option value="Aquan">Aquan</option>
                        <option value="Auran">Auran</option>
                        <option value="Ignan">Ignan</option>
                        <option value="Terran">Terran</option>
                        <option value="Silvestre">Silvestre</option>
                        <option value="Druídico">Druídico</option>
                      </optgroup>
                    </select>
                    <button class="rpg-btn" style="padding: 2px 10px; min-width: 80px; font-size: 0.8rem; height:32px;" onclick="app.addLanguage('${char.id}', ${isNewChar})">Adicionar</button>
                  </div>
                  <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:5px; min-height:35px; border:1px solid rgba(170,124,17,0.15); padding:8px; background:rgba(0,0,0,0.05); border-radius:4px;">
                    ${(char.languages || []).length === 0 ? `<em style="color:#777; font-size:0.8rem;">Nenhum idioma selecionado</em>` : ''}
                    ${(char.languages || []).map((lang, idx) => `
                      <span class="rpg-lang-badge" style="background:#5a3e09; color:#fdfaf2; font-size:0.8rem; padding: 4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:6px; font-family:var(--font-header);">
                        ${lang}
                        <span style="cursor:pointer; color:#ff4444; font-weight:bold; font-size:0.85rem;" onclick="app.removeLanguage('${char.id}', ${idx}, ${isNewChar})">×</span>
                      </span>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 3: EQUIPAMENTO & CARGA -->
        <div class="sheet-sub-tab-content" id="sheet-sec-page3" style="display: ${activeSubtab === 'page3' ? 'block' : 'none'};">
          <div class="sheet-grid-2">
            <!-- Inventory -->
            <div class="sheet-block">
              <div class="sheet-block-title">Mochila</div>
              
              <!-- Form to add backpack items -->
              <div style="background: rgba(170,124,17,0.05); border: 1px solid rgba(170,124,17,0.25); border-radius: 4px; padding: 10px; margin-bottom: 15px; box-sizing: border-box; width: 100%;">
                <div style="font-size:0.75rem; font-weight:bold; color:#5a3e09; margin-bottom:6px; text-transform:uppercase; text-align:center;">Adicionar Item à Mochila</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <input type="text" id="temp-bag-item-name" placeholder="Nome do item (Ex: Ração de viagem)" style="width:100%; height:32px; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px 8px;">
                  <div style="display:flex; gap:8px;">
                    <div style="flex:1;">
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:center;">Peso Unit. (kg)</label>
                      <input type="number" id="temp-bag-item-weight" step="0.1" min="0" placeholder="0.0" style="width:100%; height:32px; text-align:center; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px;">
                    </div>
                    <div style="flex:1;">
                      <label style="font-size:0.65rem; display:block; margin-bottom:2px; text-align:center;">Qtd</label>
                      <input type="number" id="temp-bag-item-qty" min="1" value="1" style="width:100%; height:32px; text-align:center; font-size:0.8rem; background:#fff; color:#000; box-sizing:border-box; padding:4px;">
                    </div>
                    <button class="rpg-btn" style="padding: 0 15px; font-size: 0.8rem; height:32px; margin-top:16px;" onclick="app.addBackpackItem('${char.id}', ${isNewChar})">Adicionar</button>
                  </div>
                </div>
              </div>

              <!-- List of backpack items -->
              <div style="overflow-x:auto; width:100%; margin-bottom:15px;">
                <table class="sheet-table" style="width:100%; font-size:0.8rem; border-collapse:collapse;">
                  <thead>
                    <tr style="border-bottom:1px solid rgba(170,124,17,0.3); font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">
                      <th style="text-align:left; padding:4px;">Item</th>
                      <th style="text-align:center; padding:4px; width:15%;">Qtd</th>
                      <th style="text-align:center; padding:4px; width:20%;">Peso Unit.</th>
                      <th style="text-align:center; padding:4px; width:20%;">Total</th>
                      <th style="text-align:center; padding:4px; width:10%;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(char.inventoryItems || []).length === 0 ? `
                      <tr>
                        <td colspan="5" style="text-align:center; padding:15px; color:var(--text-muted); font-style:italic;">Nenhum item na mochila. Adicione no formulário acima!</td>
                      </tr>
                    ` : (char.inventoryItems || []).map((item, idx) => {
                      const itemWeight = parseFloat(item.weight) || 0;
                      const itemQty = parseInt(item.qty) || 1;
                      const rowTotal = (itemWeight * itemQty).toFixed(1).replace('.', ',');
                      return `
                        <tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                          <td style="text-align:left; padding:6px 4px; font-weight:bold; color:#5a3e09;">${item.name}</td>
                          <td style="text-align:center; padding:6px 4px;">${itemQty}</td>
                          <td style="text-align:center; padding:6px 4px;">${itemWeight.toFixed(1).replace('.', ',')} kg</td>
                          <td style="text-align:center; padding:6px 4px; font-weight:bold;">${rowTotal} kg</td>
                          <td style="text-align:center; padding:6px 4px;">
                            <button class="rpg-btn" style="padding:1px 5px; font-size:0.65rem; border-color:#ff4444; color:#ff4444; background:transparent; margin:0;" onclick="app.deleteBackpackItem('${char.id}', ${idx}, ${isNewChar})">❌</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- General Notes fallback (backward compatibility) -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; width:100%;">
                <div style="font-size: 0.72rem; font-weight: bold; color: var(--accent-gold-dark); text-transform: uppercase;">Outras Notas da Mochila</div>
                <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; height:24px; margin:0;" onclick="app.saveBackpackNotes('${char.id}', ${isNewChar})">Salvar Notas</button>
              </div>
              <textarea id="sheet-bag-notes-textarea" data-path="inventoryText" rows="6" placeholder="Anotações gerais..." style="font-family:'Inter', sans-serif; font-size:0.8rem; line-height:1.4; background:#fff; color:#000; box-sizing:border-box; padding:6px; border:1px solid rgba(170,124,17,0.3); border-radius:4px; width:100%;">${char.inventoryText || ''}</textarea>
            </div>

            <!-- Weight and Coins -->
            <div>
              <div class="sheet-block">
                <div class="sheet-block-title">Moedas & Riquezas</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; width:100%;">
                  <div>
                    <label>Peças de Ouro (PO)</label>
                    <input type="number" value="${char.coins?.gp || 0}" data-path="coins.gp" style="background:#fff; color:#000;">
                  </div>
                  <div>
                    <label>Peças de Platina (PL)</label>
                    <input type="number" value="${char.coins?.pp || 0}" data-path="coins.pp" style="background:#fff; color:#000;">
                  </div>
                  <div>
                    <label>Peças de Prata (PP)</label>
                    <input type="number" value="${char.coins?.sp || 0}" data-path="coins.sp" style="background:#fff; color:#000;">
                  </div>
                  <div>
                    <label>Peças de Cobre (PC)</label>
                    <input type="number" value="${char.coins?.cp || 0}" data-path="coins.cp" style="background:#fff; color:#000;">
                  </div>
                </div>
              </div>

              <div class="sheet-block">
                <div class="sheet-block-title">Peso Carregado</div>
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:15px 10px; background:rgba(170,124,17,0.05); border:1px solid rgba(170,124,17,0.25); border-radius:4px; width:100%; box-sizing:border-box;">
                  <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:bold; letter-spacing:0.02em; margin-bottom:5px;">Peso Total Carregado</span>
                  <div style="font-size:2rem; font-weight:bold; color:#8b0000; font-family:'Cinzel', serif;">
                    ${app.calculateTotalCarriedWeight(char)} kg
                  </div>
                  <div style="font-size:0.65rem; color:#777; margin-top:5px; line-height:1.3; text-align:center;">
                    (Soma das Armas, Armaduras Modulares e Itens da Mochila)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 4: MAGIAS & NOTAS/XP -->
        <div class="sheet-sub-tab-content" id="sheet-sec-page4" style="display: ${activeSubtab === 'page4' ? 'block' : 'none'};">
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Spells Block -->
            <div class="sheet-block">
              <div class="sheet-block-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>📜 Grimório de Magias</span>
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">Níveis 0 a 3</span>
              </div>
              
              ${(() => {
                const spellsPerDay = {};
                const spellDifficultyClass = {};
                let isSpellcaster = false;

                if (char.classes && char.classes.length > 0) {
                  // Determine prestige spellcaster advancement
                  const prestigeCasterBonus = { divine: 0, arcane: 0, any: 0 };
                  char.classes.forEach(c => {
                    if (c.classKey === 'vingador_goriaque' || c.classKey === 'sacerdote_errante') {
                      prestigeCasterBonus.divine += (parseInt(c.level) || 0);
                    } else if (c.classKey === 'mage_of_the_arcane_order') {
                      prestigeCasterBonus.arcane += (parseInt(c.level) || 0);
                    } else if (c.classKey === 'loremaster') {
                      prestigeCasterBonus.any += (parseInt(c.level) || 0);
                    }
                  });

                  const processedBaseClasses = new Set();

                  char.classes.forEach(cls => {
                    const classKey = cls.classKey;
                    const classLevel = parseInt(cls.level) || 0;

                    let extraLevels = 0;
                    if (['cleric', 'druid', 'paladin', 'ranger'].includes(classKey)) {
                      extraLevels += prestigeCasterBonus.divine + prestigeCasterBonus.any;
                      processedBaseClasses.add(classKey);
                    } else if (['wizard', 'sorcerer', 'bard'].includes(classKey)) {
                      extraLevels += prestigeCasterBonus.arcane + prestigeCasterBonus.any;
                      processedBaseClasses.add(classKey);
                    }

                    const effectiveClassLevel = classLevel + extraLevels;
                    const baseProgress = window.DND3_Spells.getSlots(classKey, effectiveClassLevel);
                    if (baseProgress && baseProgress.length > 0) {
                      isSpellcaster = true;
                      
                      let castAttr = 'wis';
                      if (classKey === 'wizard') castAttr = 'int';
                      if (classKey === 'sorcerer' || classKey === 'bard') castAttr = 'cha';

                      const rc = window.DND3_Races[char.race] || { modifiers: {} };
                      const baseObj = char.abilitiesBase || {};
                      const getActiveAttr = (attr) => {
                        const base = parseInt(baseObj[attr]) || 10;
                        const raceMod = parseInt(rc.modifiers[attr]) || 0;
                        const lvlUpMod = parseInt(char.levelUpAttributes?.[attr]) || 0;
                        const offsetVal = char.abilitiesTemp?.[attr];
                        const offset = (offsetVal !== undefined && offsetVal !== null && offsetVal !== "" && !isNaN(parseInt(offsetVal))) ? parseInt(offsetVal) : 0;
                        
                        let armorPartMod = 0;
                        if (char.equippedArmorParts && char.equippedArmorParts.length > 0) {
                          char.equippedArmorParts.forEach(p => {
                            if (p.attrMods && p.attrMods[attr] !== undefined) {
                              armorPartMod += parseInt(p.attrMods[attr]) || 0;
                            }
                          });
                        }
                        return base + raceMod + lvlUpMod + offset + armorPartMod;
                      };

                      const abilityScore = getActiveAttr(castAttr);
                      const abilityMod = Math.floor((abilityScore - 10) / 2);

                      baseProgress.forEach((baseVal, lvl) => {
                        if (baseVal === undefined) return;
                        
                        const domainBonus = (classKey === 'cleric' && lvl > 0) ? 1 : 0;
                        const bonusVal = (lvl > 0 && abilityScore >= 10 + lvl) ? window.DND3_Spells.getBonusSpells(abilityMod, lvl) : 0;
                        const total = baseVal + bonusVal + domainBonus;

                        if (!spellsPerDay[lvl]) {
                          spellsPerDay[lvl] = { total: 0, base: 0, bonus: 0 };
                        }
                        spellsPerDay[lvl].total += total;
                        spellsPerDay[lvl].base += baseVal;
                        spellsPerDay[lvl].bonus += bonusVal + domainBonus;

                        const cd = 10 + lvl + abilityMod;
                        if (!spellDifficultyClass[lvl] || cd > spellDifficultyClass[lvl]) {
                          spellDifficultyClass[lvl] = cd;
                        }
                      });

                      // Epic Spellcasting (Level 10 Slots)
                      if (char.feats && char.feats.includes('epic_spellcasting')) {
                        const spellcraftRank = parseInt(char.skills?.spellcraft) || 0;
                        const epicSlots = Math.max(1, Math.floor(spellcraftRank / 10));
                        
                        spellsPerDay[10] = {
                          total: epicSlots,
                          base: epicSlots,
                          bonus: 0
                        };
                        spellDifficultyClass[10] = 10 + 10 + abilityMod;
                      }
                    }
                  });

                  // If character only has prestige caster class without base class registered, default divine to Cleric
                  if (!isSpellcaster && (prestigeCasterBonus.divine > 0 || prestigeCasterBonus.arcane > 0)) {
                    const fallbackClass = prestigeCasterBonus.divine > 0 ? 'cleric' : 'wizard';
                    const fallbackLvl = prestigeCasterBonus.divine > 0 ? prestigeCasterBonus.divine : prestigeCasterBonus.arcane;
                    const baseProgress = window.DND3_Spells.getSlots(fallbackClass, fallbackLvl);
                    if (baseProgress && baseProgress.length > 0) {
                      isSpellcaster = true;
                      let castAttr = fallbackClass === 'wizard' ? 'int' : 'wis';
                      const rc = window.DND3_Races[char.race] || { modifiers: {} };
                      const baseObj = char.abilitiesBase || {};
                      const abilityScore = (parseInt(baseObj[castAttr]) || 10) + (parseInt(rc.modifiers[castAttr]) || 0);
                      const abilityMod = Math.floor((abilityScore - 10) / 2);

                      baseProgress.forEach((baseVal, lvl) => {
                        if (baseVal === undefined) return;
                        const domainBonus = (fallbackClass === 'cleric' && lvl > 0) ? 1 : 0;
                        const bonusVal = (lvl > 0 && abilityScore >= 10 + lvl) ? window.DND3_Spells.getBonusSpells(abilityMod, lvl) : 0;
                        const total = baseVal + bonusVal + domainBonus;
                        if (!spellsPerDay[lvl]) spellsPerDay[lvl] = { total: 0, base: 0, bonus: 0 };
                        spellsPerDay[lvl].total += total;
                        spellsPerDay[lvl].base += baseVal;
                        spellsPerDay[lvl].bonus += bonusVal + domainBonus;
                        const cd = 10 + lvl + abilityMod;
                        if (!spellDifficultyClass[lvl] || cd > spellDifficultyClass[lvl]) spellDifficultyClass[lvl] = cd;
                      });
                    }
                  }
                }

                if (!isSpellcaster) {
                  return `<div style="padding: 15px; text-align: center; color: var(--text-muted); font-style: italic; font-size: 0.85rem;">
                    Este personagem não possui níveis em uma classe conjuradora (Mago, Clérigo, Druida, Feiticeiro, Bardo, Paladino, Ranger, Sacerdote Errante, Vingador de Goriaque) para habilitar o Grimório de Magias.
                  </div>`;
                }

                const castingClasses = char.classes ? char.classes.map(c => {
                  if (c.classKey === 'sacerdote_errante' || c.classKey === 'vingador_goriaque') return 'cleric';
                  if (c.classKey === 'mage_of_the_arcane_order') return 'wizard';
                  return c.classKey;
                }).filter(k => ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'paladin', 'ranger'].includes(k)) : [];
                const availableSpells = Object.keys(window.DND3_SpellDatabase).filter(k => {
                  const spell = window.DND3_SpellDatabase[k];
                  const matchesClass = spell.classes.some(c => castingClasses.includes(c));
                  const matchesLevel = spellsPerDay[spell.level] !== undefined && spellsPerDay[spell.level].total > 0;
                  return matchesClass && matchesLevel;
                });

                const spellsByLevel = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [], 10: [] };
                (char.spellsKnown || []).forEach(k => {
                  const spell = window.DND3_SpellDatabase[k];
                  if (spell) {
                    if (spellsByLevel[spell.level] === undefined) {
                      spellsByLevel[spell.level] = [];
                    }
                    spellsByLevel[spell.level].push({ key: k, data: spell });
                  }
                });

                let slotsHtml = `
                  <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(170,124,17,0.2); border-radius: 4px; padding: 10px; margin-bottom: 15px;">
                    <div style="font-weight:bold; font-size:0.8rem; color:var(--accent-gold); margin-bottom:8px; font-family:var(--font-header);">Magias por Dia (Preparadas & Gastas)</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
                `;

                Object.keys(spellsPerDay).forEach(lvl => {
                  const slotsData = spellsPerDay[lvl];
                  const spent = (char.spellSlotsSpent && char.spellSlotsSpent[lvl]) || 0;
                  const available = Math.max(0, slotsData.total - spent);
                  const cdVal = spellDifficultyClass[lvl] || 10;
                  slotsHtml += `
                    <div style="padding: 6px; background: rgba(0,0,0,0.2); border-radius: 4px; text-align: center; border: 1px solid rgba(170,124,17,0.15);">
                      <div style="font-weight: bold; font-size: 0.75rem; color: var(--accent-gold-dark);">Nível ${lvl} (CD ${cdVal})</div>
                      <div style="font-size: 1rem; font-weight: bold; margin: 2px 0;">${available} / ${slotsData.total}</div>
                      <div style="font-size: 0.6rem; color: var(--text-muted); margin-bottom: 4px;">Base: ${slotsData.base} | Bônus: ${slotsData.bonus}</div>
                      <div style="display: flex; gap: 4px; justify-content: center;">
                        <button class="rpg-btn" style="padding: 1px 4px; font-size: 0.65rem; height: 18px; min-width: 18px; background:#5a3e09; color:#fdfaf2; border-color:#5a3e09;" onclick="app.sheetUseSpellSlotInteractive('${char.id}', ${lvl}, 1, ${isNewChar})" ${available <= 0 ? 'disabled' : ''}>-1</button>
                        <button class="rpg-btn" style="padding: 1px 4px; font-size: 0.65rem; height: 18px; min-width: 18px; background:transparent; border-color:var(--text-muted); color:var(--text-muted);" onclick="app.sheetUseSpellSlotInteractive('${char.id}', ${lvl}, -1, ${isNewChar})" ${spent <= 0 ? 'disabled' : ''}>+1</button>
                      </div>
                    </div>
                  `;
                });
                slotsHtml += `</div></div>`;

                let lookupHtml = `
                  <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(170,124,17,0.15); border-radius: 4px; padding: 10px; margin-bottom: 15px; text-align: left;">
                    <div style="font-weight:bold; font-size:0.8rem; color:var(--accent-gold); margin-bottom:6px; font-family:var(--font-header);">📖 Biblioteca / Consulta de Magias</div>
                    <div style="display:flex; gap:6px;">
                      <select id="sheet-spell-lookup-select" class="rpg-select" style="flex:1; font-size:0.8rem; height:30px; background:#ffffff; border-color:var(--accent-gold-dark); color:#000000;" onchange="app.lookupSpellDetails(this.value)">
                        <option value="" style="color:#000000; background-color:#ffffff;">-- Selecionar Magia para Consultar --</option>
                        ${Object.keys(window.DND3_SpellDatabase).map(k => {
                          const sp = window.DND3_SpellDatabase[k];
                          return `<option value="${k}" style="color:#000000; background-color:#ffffff;">[Nível ${sp.level}] ${sp.name}</option>`;
                        }).join('')}
                      </select>
                    </div>
                    <div id="sheet-spell-lookup-result" style="margin-top: 8px; font-size: 0.75rem; display: none; padding: 8px; background: rgba(0,0,0,0.3); border: 1px dashed rgba(170,124,17,0.2); border-radius: 4px;">
                    </div>
                  </div>
                `;

                let selectorHtml = `
                  <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:15px;">
                    <div style="display:flex; gap:6px; align-items:center;">
                      <input type="text" id="sheet-spell-search-input" class="rpg-input" placeholder="Digitar para filtrar magias..." style="flex:1; font-size:0.8rem; height:30px; background:rgba(0,0,0,0.3); border-color:var(--accent-gold-dark); color:var(--text-parchment);" oninput="app.filterSheetSpellOptions()">
                    </div>
                    <div style="display:flex; gap:6px;">
                      <select id="sheet-spell-select" class="rpg-select" style="flex:1; font-size:0.8rem; height:30px; background:#ffffff; border-color:var(--accent-gold-dark); color:#000000;">
                        <option value="" style="color:#000000; background-color:#ffffff;">-- Adicionar Magia da Classe --</option>
                        ${availableSpells.map(k => {
                          const sp = window.DND3_SpellDatabase[k];
                          return `<option value="${k}" style="color:#000000; background-color:#ffffff;">[Nível ${sp.level}] ${sp.name}</option>`;
                        }).join('')}
                      </select>
                      <button class="rpg-btn" style="padding:0 12px; font-size:0.75rem; height:30px; background:#5a3e09; color:#fdfaf2; border-color:#5a3e09;" onclick="app.addSpellToSheet('${char.id}', ${isNewChar})">Adicionar</button>
                    </div>
                  </div>
                `;

                let listHtml = "";
                for (let lvl = 0; lvl <= 10; lvl++) {
                  if (spellsPerDay[lvl] === undefined) continue;
                  const list = spellsByLevel[lvl] || [];
                  const cdVal = spellDifficultyClass[lvl] || 10;
                  
                  listHtml += `
                    <div style="margin-top: 10px;">
                      <div style="font-weight: bold; font-size: 0.8rem; color: var(--accent-gold); border-bottom: 1px solid rgba(170,124,17,0.2); padding-bottom: 2px; margin-bottom: 6px; font-family:var(--font-header);">
                        Magias de Nível ${lvl} (CD ${cdVal})
                      </div>
                      ${list.length === 0 ? `
                        <div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:4px 8px;">Nenhuma magia adicionada neste nível.</div>
                      ` : list.map(item => {
                        const sp = item.data;
                        return `
                          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(170,124,17,0.15); border-radius:4px; padding:8px 10px; margin-bottom:6px; font-size:0.75rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                              <strong>${sp.name}</strong>
                              <button class="rpg-btn" style="padding:1px 4px; font-size:0.65rem; border-color:#cc3333; color:#cc3333; background:transparent;" onclick="app.removeSpellFromSheet('${char.id}', '${item.key}', ${isNewChar})">Remover</button>
                            </div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px; display:grid; grid-template-columns: 1fr 1fr; gap:2px 10px;">
                              <div><strong>Escola:</strong> ${sp.school}</div>
                              <div><strong>Alcance:</strong> ${sp.range}</div>
                              <div><strong>Duração:</strong> ${sp.duration}</div>
                              <div><strong>Resistência:</strong> ${sp.save}</div>
                              <div><strong>Dano/Efeito:</strong> <span style="color:var(--accent-gold);">${sp.damage}</span></div>
                              <div style="grid-column: 1 / -1; margin-top:2px; font-style:italic;"><strong>Efeito:</strong> ${sp.desc}</div>
                              <div style="grid-column: 1 / -1; color:#ff9999; font-size:0.65rem; margin-top:2px;"><strong>Como Executar:</strong> ${sp.check}</div>
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                }
                return slotsHtml + lookupHtml + selectorHtml + listHtml;
              })()}
            </div>

            <!-- Campaign Notes -->
            <div class="sheet-block">
              <div class="sheet-block-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <span>✍️ Notas de Campanha</span>
                <button type="button" class="rpg-btn" style="padding: 4px 12px; font-size: 0.8rem; background: #5a3e09; color: #fdfaf2; border: 1px solid #d4af37; margin:0;" onclick="app.saveCampaignNotes('${char.id}', ${isNewChar})">💾 Salvar Notas</button>
              </div>
              <textarea id="campaign-notes-textarea" data-path="notes" rows="12" placeholder="Escreva sobre suas origens, aventuras, diários..." style="font-family:'Inter',sans-serif; line-height:1.5; width: 100%; border: 1px solid rgba(90,62,9,0.3); border-radius: 4px; padding: 10px; background: #fff; color: #000; box-sizing: border-box;">${char.notes || ''}</textarea>
            </div>

          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;

    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => this.handleSheetInputChange(e, char, isNewChar));
      input.addEventListener('change', (e) => this.handleSheetInputChange(e, char, isNewChar));
    });

    this.recalculateSheetModifiers(char, container);
    this.renderXPSessionsList(char, isNewChar);
  }

  recalculateSheetModifiers(char, container) {
    if (!container) return;
    this.normalizeCharacter(char, true);

    const base = char.abilitiesBase;
    const temp = char.abilitiesTemp;

    // Automatically calculate size modifier based on size category
    const sizeMap = {
      'Fine': 8,
      'Diminutive': 4,
      'Tiny': 2,
      'Small': 1,
      'Medium': 0,
      'Large': -1,
      'Huge': -2,
      'Gargantuan': -4,
      'Colossal': -8
    };
    const sizeModVal = sizeMap[char.size] !== undefined ? sizeMap[char.size] : 0;
    char.acSize = sizeModVal;
    
    const acSizeInput = container.querySelector('input[data-path="acSize"]');
    if (acSizeInput) acSizeInput.value = sizeModVal;
    
    const rc = window.DND3_Races[char.race] || { modifiers: {} };

    const mods = {};
    const activeMods = {};

    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => {
      const raceMod = parseInt(rc.modifiers?.[a]) || 0;
      const lvlUpMod = parseInt(char.levelUpAttributes?.[a]) || 0;
      const baseInputVal = parseInt(base[a]) || 10;
      const val = baseInputVal + raceMod + lvlUpMod;
      const tempVal = temp[a] !== undefined && temp[a] !== null && temp[a] !== "" ? temp[a] : "";
      const offset = (tempVal !== "" && !isNaN(parseInt(tempVal))) ? parseInt(tempVal) : 0;

      let rageBonus = 0;
      const isRageActive = (char.specialAbilities || []).includes('rage') && char.rageActive;
      if (isRageActive && (a === 'str' || a === 'con')) {
        rageBonus = 4;
      }

      const tVal = val + offset + rageBonus;
      
      mods[a] = Math.floor((val - 10) / 2);
      activeMods[a] = Math.floor((tVal - 10) / 2);
      const tempModContribution = activeMods[a] - mods[a];
      
      const baseInput = container.querySelector(`input[data-path="abilitiesBase.${a}"]`);
      if (baseInput) {
        if (document.activeElement !== baseInput) {
          baseInput.value = val;
        }
      }
      
      const modEl = container.querySelector(`#sheet-mod-${a}`);
      if (modEl) modEl.textContent = mods[a] >= 0 ? '+' + mods[a] : mods[a];
      
      const tempModEl = container.querySelector(`#sheet-modtemp-${a}`);
      if (tempModEl) {
        if (tempVal !== "") {
          tempModEl.textContent = tempModContribution >= 0 ? '+' + tempModContribution : tempModContribution;
          if (tempModContribution !== 0) {
            tempModEl.style.color = tempModContribution > 0 ? '#aa7c11' : '#ff4444';
            tempModEl.style.fontWeight = 'bold';
          } else {
            tempModEl.style.color = "#555";
            tempModEl.style.fontWeight = "";
          }
        } else {
          tempModEl.textContent = "+0";
          tempModEl.style.color = "#555";
          tempModEl.style.fontWeight = "";
        }
      }

      const totalValEl = container.querySelector(`#sheet-totalval-${a}`);
      if (totalValEl) totalValEl.textContent = tVal;

      const totalModEl = container.querySelector(`#sheet-totalmod-${a}`);
      if (totalModEl) totalModEl.textContent = activeMods[a] >= 0 ? '+' + activeMods[a] : activeMods[a];
    });

    const activeCon = activeMods.con || 0;
    const dexMod = activeMods.dex || 0;
    const activeWis = activeMods.wis || 0;

    const racialSaveBonus = char.race === 'halfling' ? 1 : 0;
    let deitySaveBonus = 0;
    if (char.deity && window.DND3_Deities && window.DND3_Deities[char.deity]) {
      const dObj = window.DND3_Deities[char.deity];
      if (dObj.bonusType === 'save') {
        deitySaveBonus = dObj.bonusVal;
      }
    }

    const fortBaseVal = parseInt(char.saveFortBase) || 0;
    const fortMagicVal = parseInt(char.saveFortMagic) || 0;
    const fortMiscVal = parseInt(char.saveFortMisc) || 0;
    const fortTempVal = parseInt(char.saveFortTemp) || 0;
    const fortTotal = fortBaseVal + activeCon + fortMagicVal + fortMiscVal + fortTempVal + racialSaveBonus + deitySaveBonus;

    const refBaseVal = parseInt(char.saveRefBase) || 0;
    const refMagicVal = parseInt(char.saveRefMagic) || 0;
    const refMiscVal = parseInt(char.saveRefMisc) || 0;
    const refTempVal = parseInt(char.saveRefTemp) || 0;
    const refTotal = refBaseVal + dexMod + refMagicVal + refMiscVal + refTempVal + racialSaveBonus + deitySaveBonus;

    const willBaseVal = parseInt(char.saveWillBase) || 0;
    const willMagicVal = parseInt(char.saveWillMagic) || 0;
    const willMiscVal = parseInt(char.saveWillMisc) || 0;
    const willTempVal = parseInt(char.saveWillTemp) || 0;
    const willTotal = willBaseVal + activeWis + willMagicVal + willMiscVal + willTempVal + racialSaveBonus + deitySaveBonus;

    const fortTotalEl = container.querySelector('#sheet-save-fort-total');
    if (fortTotalEl) fortTotalEl.textContent = fortTotal >= 0 ? '+' + fortTotal : fortTotal;
    const fortModEl = container.querySelector('#sheet-save-fort-mod');
    if (fortModEl) fortModEl.textContent = activeCon >= 0 ? '+' + activeCon : activeCon;

    const refTotalEl = container.querySelector('#sheet-save-ref-total');
    if (refTotalEl) refTotalEl.textContent = refTotal >= 0 ? '+' + refTotal : refTotal;
    const refModEl = container.querySelector('#sheet-save-ref-mod');
    if (refModEl) refModEl.textContent = dexMod >= 0 ? '+' + dexMod : dexMod;

    const willTotalEl = container.querySelector('#sheet-save-will-total');
    if (willTotalEl) willTotalEl.textContent = willTotal >= 0 ? '+' + willTotal : willTotal;
    const willModEl = container.querySelector('#sheet-save-will-mod');
    if (willModEl) willModEl.textContent = activeWis >= 0 ? '+' + activeWis : activeWis;

    // AC Calculations
    const acArmorVal = parseInt(char.acArmor) || 0;
    const acShieldVal = parseInt(char.acShield) || 0;
    const acNaturalVal = parseInt(char.acNatural) || 0;
    const acDeflectionVal = parseInt(char.acDeflection) || 0;
    const acMiscVal = parseInt(char.acMisc) || 0;

    let dodgeBonus = 0;
    if ((char.feats || []).includes('dodge')) dodgeBonus += 1;

    let deityAcBonus = 0;
    if (char.deity && window.DND3_Deities && window.DND3_Deities[char.deity]) {
      const dObj = window.DND3_Deities[char.deity];
      if (dObj.bonusType === 'ac') {
        deityAcBonus = dObj.bonusVal;
      }
    }

    let monkAcBonus = 0;
    if (char.class === 'monk' && !char.armorName && !char.shieldName) {
      monkAcBonus = Math.max(0, activeWis);
    }

    const acTotal = 10 + acArmorVal + acShieldVal + dexMod + sizeModVal + acNaturalVal + acDeflectionVal + acMiscVal + dodgeBonus + deityAcBonus + monkAcBonus;
    const acTouch = 10 + dexMod + sizeModVal + acDeflectionVal + acMiscVal + dodgeBonus + deityAcBonus + monkAcBonus;
    const acFlatFooted = 10 + acArmorVal + acShieldVal + sizeModVal + acNaturalVal + acDeflectionVal + acMiscVal + deityAcBonus;

    const acTotalEl = container.querySelector('#sheet-ac-total');
    if (acTotalEl) acTotalEl.textContent = acTotal;
    const acTouchEl = container.querySelector('#sheet-ac-touch');
    if (acTouchEl) acTouchEl.textContent = acTouch;
    const acFlatFootedEl = container.querySelector('#sheet-ac-flatfooted');
    if (acFlatFootedEl) acFlatFootedEl.textContent = acFlatFooted;
    const acDexEl = container.querySelector('#sheet-ac-dex');
    if (acDexEl) acDexEl.textContent = dexMod >= 0 ? '+' + dexMod : dexMod;

    // Initiative
    const initMiscTotal = (char.initiativeMods || []).reduce((acc, curr) => acc + (parseInt(curr.val) || 0), 0);
    const initTotal = dexMod + initMiscTotal;
    const initTotalEl = container.querySelector('#sheet-init-total');
    if (initTotalEl) initTotalEl.textContent = initTotal >= 0 ? '+' + initTotal : initTotal;
    const initDexEl = container.querySelector('#sheet-init-dex');
    if (initDexEl) initDexEl.textContent = dexMod >= 0 ? '+' + dexMod : dexMod;

    // Base Attack Bonus & Combat
    const babVal = parseInt(char.bab) || 0;
    const meleeStr = activeMods.str || 0;
    const meleeTotal = babVal + meleeStr + sizeModVal + (parseInt(char.meleeMisc) || 0) + (parseInt(char.meleeTemp) || 0);
    const rangedTotal = babVal + dexMod + sizeModVal + (parseInt(char.rangedMisc) || 0) + (parseInt(char.rangedTemp) || 0);

    const meleeTotalEl = container.querySelector('#sheet-melee-total');
    if (meleeTotalEl) meleeTotalEl.textContent = meleeTotal >= 0 ? '+' + meleeTotal : meleeTotal;
    const meleeStrEl = container.querySelector('#sheet-melee-str');
    if (meleeStrEl) meleeStrEl.textContent = meleeStr >= 0 ? '+' + meleeStr : meleeStr;
    const meleeSizeEl = container.querySelector('#sheet-melee-size');
    if (meleeSizeEl) meleeSizeEl.textContent = sizeModVal >= 0 ? '+' + sizeModVal : sizeModVal;

    const rangedTotalEl = container.querySelector('#sheet-ranged-total');
    if (rangedTotalEl) rangedTotalEl.textContent = rangedTotal >= 0 ? '+' + rangedTotal : rangedTotal;
    const rangedDexEl = container.querySelector('#sheet-ranged-dex');
    if (rangedDexEl) rangedDexEl.textContent = dexMod >= 0 ? '+' + dexMod : dexMod;
    const rangedSizeEl = container.querySelector('#sheet-ranged-size');
    if (rangedSizeEl) rangedSizeEl.textContent = sizeModVal >= 0 ? '+' + sizeModVal : sizeModVal;

    Object.keys(window.DND3_Skills).forEach(k => {
      const sk = window.DND3_Skills[k];
      const ranks = char.skillRanks[k] || 0;
      const manualMisc = char.skillMisc[k] || 0;
      const racialSkillBonus = (window.DND3_RacialSkillBonuses && window.DND3_RacialSkillBonuses[char.race] && window.DND3_RacialSkillBonuses[char.race][k]) ? window.DND3_RacialSkillBonuses[char.race][k] : 0;
      const misc = manualMisc + racialSkillBonus;
      const abilityMod = activeMods[sk.keyAbility] !== undefined ? activeMods[sk.keyAbility] : (mods[sk.keyAbility] || 0);
      
      let sizeSkillBonus = 0;
      if (k === 'hide') {
        const hideSizeMap = {
          'Fine': 16,
          'Diminutive': 12,
          'Tiny': 8,
          'Small': 4,
          'Medium': 0,
          'Large': -4,
          'Huge': -8,
          'Gargantuan': -12,
          'Colossal': -16
        };
        sizeSkillBonus = hideSizeMap[char.size] !== undefined ? hideSizeMap[char.size] : 0;
      }

      let featSkillBonus = 0;
      if ((char.feats || []).includes('alertness')) {
        if (k === 'listen' || k === 'spot') {
          featSkillBonus = 2;
        }
      }

      let deitySkillBonus = 0;
      if (char.deity && window.DND3_Deities && window.DND3_Deities[char.deity]) {
        const dObj = window.DND3_Deities[char.deity];
        if (dObj.bonusType === 'skill' && dObj.bonusSkill === k) {
          deitySkillBonus = dObj.bonusVal;
        } else if (dObj.bonusType === 'multi_skill' && dObj.bonusSkills.includes(k)) {
          deitySkillBonus = dObj.bonusVal;
        }
      }

      const total = ranks + misc + abilityMod + sizeSkillBonus + featSkillBonus + deitySkillBonus;

      const totalEl = container.querySelector(`#sheet-skill-total-${k}`);
      if (totalEl) totalEl.textContent = total >= 0 ? '+' + total : total;
      const modEl = container.querySelector(`#sheet-skill-mod-${k}`);
      if (modEl) modEl.textContent = abilityMod >= 0 ? '+' + abilityMod : abilityMod;
    });

    // Update skill points counter
    const spentPts = this.calculateSpentSkillPoints(char);
    const maxPts = this.calculateMaxSkillPoints(char);
    const counterEl = container.querySelector('#sheet-skill-points-counter-display');
    if (counterEl) counterEl.textContent = `Pontos: ${spentPts} / ${maxPts}`;

    // Recalculate HP
    this.updateMaxHp(char);
    char._lastCalculatedConMod = activeCon;
    
    const hpAutoInput = container.querySelector('#sheet-hp-automatic');
    if (hpAutoInput) hpAutoInput.value = char.hpMax;
    
    const hpMaxInput = container.querySelector('#sheet-hp-max');
    if (hpMaxInput && document.activeElement !== hpMaxInput) hpMaxInput.value = char.hpMax;

    const hpCurrentInput = container.querySelector('#sheet-hp-current') || container.querySelector('input[data-path="currentHp"]');
    if (hpCurrentInput && document.activeElement !== hpCurrentInput && char.currentHp !== undefined) hpCurrentInput.value = char.currentHp;

    // Update Spell Resistance (RM) if Diamond Soul is active
    if ((char.specialAbilities || []).includes('diamond_soul')) {
      const expectedSR = (char.level || 1) + 10;
      if (char.sr !== expectedSR) {
        char.sr = expectedSR;
      }
      const srInput = container.querySelector('input[data-path="sr"]');
      if (srInput) srInput.value = expectedSR;
    }
  }

  renderXPSessionsList(char, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const listContainer = container.querySelector('#sheet-xp-sessions-list-container');
    if (!listContainer) return;

    if (!char.xpSessions || char.xpSessions.length === 0) {
      listContainer.innerHTML = `<em style="color:#777; font-size:0.85rem; display:block; padding:10px; text-align:center;">Nenhum ganho de XP registrado por sessão.</em>`;
      return;
    }

    let html = `
      <table class="sheet-xp-sessions-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:rgba(170,124,17,0.1); font-size:0.75rem;">
            <th style="padding:4px; border:1px solid rgba(0,0,0,0.1); text-align:left;">Sessão</th>
            <th style="padding:4px; border:1px solid rgba(0,0,0,0.1); text-align:center; width:80px;">XP</th>
            <th style="padding:4px; border:1px solid rgba(0,0,0,0.1); text-align:center; width:60px;">Ação</th>
          </tr>
        </thead>
        <tbody>
          ${char.xpSessions.map((s, idx) => `
            <tr style="font-size:0.75rem; border-bottom:1px solid rgba(0,0,0,0.05);">
              <td style="padding:4px; border:1px solid rgba(0,0,0,0.05); text-align:left; color:#1a1a1a;"><strong>${s.sessionName}</strong></td>
              <td style="padding:4px; border:1px solid rgba(0,0,0,0.05); text-align:center; font-weight:bold; color:${s.xpAmt >= 0 ? '#aa7c11' : '#ff4444'};">
                ${s.xpAmt >= 0 ? '+' : ''}${s.xpAmt}
              </td>
              <td style="padding:4px; border:1px solid rgba(0,0,0,0.05); text-align:center;">
                <button class="rpg-btn" style="padding:1px 6px; font-size:0.65rem; background:#ff4444; border-color:#ff4444; color:#fff;" onclick="app.deleteSessionXP('${char.id}', ${idx}, ${isNew})">X</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    listContainer.innerHTML = html;
    
    setTimeout(() => {
      listContainer.scrollTop = listContainer.scrollHeight;
    }, 50);
  }

  addSessionXP(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const nameEl = container.querySelector('#new-session-name');
    const xpEl = container.querySelector('#new-session-xp');
    const opEl = container.querySelector('#new-session-op');
    if (!nameEl || !xpEl) return;

    let sessionName = nameEl.value.trim();
    const rawXp = parseInt(xpEl.value) || 0;
    const isSubtraction = opEl ? opEl.value === '-' : false;

    if (rawXp <= 0) {
      alert("Por favor, digite uma quantidade de XP válida e maior que zero.");
      return;
    }

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    // Automatically append date
    const currentDate = new Date().toLocaleDateString('pt-BR');
    if (!sessionName) {
      sessionName = `Sessão (${currentDate})`;
    } else {
      sessionName = `${sessionName} (${currentDate})`;
    }

    const xpAmt = isSubtraction ? -rawXp : rawXp;

    if (!char.xpSessions) char.xpSessions = [];
    char.xpSessions.push({ sessionName, xpAmt });

    char.xp = (char.xp || 0) + xpAmt;
    if (char.xp < 0) char.xp = 0;
    
    this.normalizeCharacter(char, false); // Let normalizeCharacter handle level changes, alerts, and announcements!

    const xpTotalInput = container.querySelector('#sheet-xp-total-input');
    if (xpTotalInput) xpTotalInput.value = char.xp;

    const levelInput = container.querySelector('input[data-path="level"]');
    if (levelInput) levelInput.value = char.level;

    this.recalculateSheetModifiers(char, container);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    this.logAction(`XP alterada para ${char.name}: ${sessionName} (${xpAmt >= 0 ? '+' : ''}${xpAmt} XP). Novo total: ${char.xp} XP (Nível ${char.level}).`);

    nameEl.value = '';
    xpEl.value = '';
    this.renderXPSessionsList(char, isNew);
    
    // Also re-render sheet details so that the base saves and BAB inputs update if level changed
    if (!isNew) {
      this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
    } else {
      this.renderOfficialSheet(char, document.getElementById('official-sheet-creator-container'), true);
    }
    
    this.showToast(`XP atualizado com sucesso (${isSubtraction ? '-' : '+'}${rawXp} XP)`);
  }

  deleteSessionXP(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    this.showCustomConfirm("Excluir este ganho de XP?", () => {
      const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
      if (!char) return;

      const removed = char.xpSessions.splice(idx, 1)[0];
      char.xp -= removed.xpAmt; // Reverse the addition/subtraction
      if (char.xp < 0) char.xp = 0;
      
      this.normalizeCharacter(char, false); // This will update class base stats and handle level-down if level changed!

      const xpTotalInput = container.querySelector('#sheet-xp-total-input');
      if (xpTotalInput) xpTotalInput.value = char.xp;

      const levelInput = container.querySelector('input[data-path="level"]');
      if (levelInput) levelInput.value = char.level;

      this.recalculateSheetModifiers(char, container);

      if (!isNew) {
        this.saveCharactersState();
      } else {
        localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      }

      this.logAction(`Excluiu registro de XP de ${char.name}: ${removed.sessionName} (${removed.xpAmt >= 0 ? '+' : ''}${removed.xpAmt} XP). Novo total: ${char.xp} XP (Nível ${char.level}).`);

      this.renderXPSessionsList(char, isNew);
      
      // Also re-render sheet details so that the base saves and BAB inputs update if level changed
      if (!isNew) {
        this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
      } else {
        this.renderOfficialSheet(char, document.getElementById('official-sheet-creator-container'), true);
      }
      this.showToast(`XP removida: ${removed.sessionName} (${removed.xpAmt >= 0 ? '-' : '+'}${Math.abs(removed.xpAmt)} XP)`);
    });
  }

  clearSessionXP(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    this.showCustomConfirm("Tem certeza que deseja limpar todo o histórico de XP? Isso zerará o XP acumulado do personagem e retornará o nível para 1.", () => {
      const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
      if (!char) return;

      char.xpSessions = [];
      char.xp = 0;
      
      this.normalizeCharacter(char, false); // Recalculate based on 0 XP and handle level down if needed

      const xpTotalInput = container.querySelector('#sheet-xp-total-input');
      if (xpTotalInput) xpTotalInput.value = char.xp;

      const levelInput = container.querySelector('input[data-path="level"]');
      if (levelInput) levelInput.value = char.level;

      this.recalculateSheetModifiers(char, container);

      if (!isNew) {
        this.saveCharactersState();
      } else {
        localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      }

      this.logAction(`Limpou todo o histórico de XP de ${char.name}. Total zerado.`);

      this.renderXPSessionsList(char, isNew);
      
      if (!isNew) {
        this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
      } else {
        this.renderOfficialSheet(char, document.getElementById('official-sheet-creator-container'), true);
      }

      this.showToast("Histórico de XP zerado com sucesso!");
    });
  }

  showLevelUpAnnouncement(newLevel) {
    // Create elements for a beautiful overlay announcement
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.6s ease';
    overlay.style.pointerEvents = 'all';
    overlay.style.cursor = 'pointer';

    overlay.innerHTML = `
      <div style="text-align: center; transform: scale(0.8); transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; padding: 40px; border-radius: 50%;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle, rgba(218,165,32,0.2) 0%, rgba(0,0,0,0) 70%); z-index: -1;"></div>
        <h1 style="font-family: 'Cinzel', serif; font-size: 4rem; color: #f59e0b; margin: 0; text-shadow: 0 0 20px rgba(245, 158, 11, 0.8), 0 0 40px rgba(245, 158, 11, 0.4); letter-spacing: 4px; animation: pulseGlow 2s infinite alternate;">LEVEL UP!</h1>
        <div style="font-family: 'Cinzel', serif; font-size: 1.8rem; color: #fdfaf2; margin-top: 15px; text-shadow: 0 2px 4px rgba(0,0,0,0.8); letter-spacing: 1px;">Você alcançou o Nível ${newLevel}</div>
        <div style="margin-top: 30px; font-family: 'Inter', sans-serif; font-size: 1rem; color: #aa7c11; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Suas estatísticas de combate aumentaram!</div>
        <button class="rpg-btn" style="margin-top: 40px; padding: 10px 30px; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(218,165,32,0.4);">Continuar</button>
      </div>
      <style>
        @keyframes pulseGlow {
          0% { text-shadow: 0 0 20px rgba(245, 158, 11, 0.8), 0 0 40px rgba(245, 158, 11, 0.4); }
          100% { text-shadow: 0 0 35px rgba(245, 158, 11, 0.9), 0 0 70px rgba(245, 158, 11, 0.6), 0 0 100px rgba(245, 158, 11, 0.3); }
        }
      </style>
    `;

    document.body.appendChild(overlay);

    // Fade in
    setTimeout(() => {
      overlay.style.opacity = '1';
      overlay.querySelector('div').style.transform = 'scale(1)';
    }, 50);

    // Dismiss on click anywhere on overlay
    overlay.addEventListener('click', () => {
      overlay.style.opacity = '0';
      overlay.querySelector('div').style.transform = 'scale(0.8)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    });
  }

  addLanguage(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const selectEl = container.querySelector('#sheet-add-language-select');
    if (!selectEl) return;

    const lang = selectEl.value;
    if (!lang) return;

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.languages) char.languages = [];
    if (char.languages.includes(lang)) {
      this.showToast("Este idioma já foi adicionado.");
      return;
    }

    char.languages.push(lang);

    // Save to localStorage
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    // Re-render the sheet to reflect the new language in the list
    this.renderOfficialSheet(char, container, isNew);
  }

  removeLanguage(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.languages) {
      char.languages.splice(idx, 1);
    }

    // Save to localStorage
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    // Re-render the sheet
    this.renderOfficialSheet(char, container, isNew);
  }

  saveCharacterSheet(charId, isNewChar) {
    const char = isNewChar ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.name.trim()) {
      alert("Por favor, preencha o Nome do Personagem antes de salvar.");
      return;
    }

    if (isNewChar) {
      const finalSheet = {
        ...char,
        id: 'char_' + Date.now(),
        owner: this.currentUser ? String(this.currentUser.username).trim() : 'mestre'
      };
      
      this.savedCharacters.push(finalSheet);
      this.saveCharactersState();
      
      this.logAction(`Criou o personagem: ${finalSheet.name} (Classe: ${finalSheet.class}, Nível: ${finalSheet.level})`);
      alert(`Herói ${finalSheet.name} salvo com sucesso!`);
      this.resetNewChar();
      localStorage.removeItem('dnd3_new_char');
      
      this.switchTab('sheets');
    } else {
      this.saveCharactersState();
      this.logAction(`Salvou alterações no personagem: ${char.name} (Nível: ${char.level}, XP: ${char.xp})`);
      alert(`Alterações da ficha de ${char.name} salvas com sucesso!`);
      this.closeCharacterSheet();
    }
  }

  saveCampaignNotes(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const textarea = container.querySelector('#campaign-notes-textarea');
    if (textarea) {
      char.notes = textarea.value;
      if (!isNew) {
        this.saveCharactersState();
        this.logAction(`Salvou Notas de Campanha de ${char.name}`);
        this.showToast("Notas de Campanha salvas com sucesso!");
      } else {
        localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
        this.showToast("Notas de Campanha salvas localmente!");
      }
    }
  }

  isClassSkill(char, skillKey) {
    if (!char.classes) return false;
    return char.classes.some(c => {
      const clsData = window.DND3_Classes[c.classKey];
      return clsData && clsData.classSkills && clsData.classSkills.includes(skillKey);
    });
  }

  calculateMaxSkillPoints(char) {
    if (!char.classes || char.classes.length === 0) return 0;
    
    const stats = this.calculateDerivedStats(char);
    const intMod = stats.mods.int;
    
    let totalPoints = 0;
    const isHuman = char.race === 'human';
    let isFirstLvl = true;
    
    char.classes.forEach(c => {
      const clsData = window.DND3_Classes[c.classKey];
      if (!clsData) return;
      const basePoints = clsData.skillPoints || 2;
      
      for (let i = 0; i < c.level; i++) {
        let pts = basePoints + intMod;
        if (pts < 1) pts = 1; // Minimum 1 point per level
        
        if (isFirstLvl) {
          pts *= 4;
          if (isHuman) pts += 4;
          isFirstLvl = false;
        } else {
          if (isHuman) pts += 1;
        }
        totalPoints += pts;
      }
    });
    
    return totalPoints;
  }

  calculateSpentSkillPoints(char) {
    let spent = 0;
    if (!char.skillRanks) return 0;
    for (let k in char.skillRanks) {
      const ranks = parseFloat(char.skillRanks[k]) || 0;
      if (ranks > 0) {
        if (this.isClassSkill(char, k)) {
          spent += ranks;
        } else {
          spent += ranks * 2;
        }
      }
    }
    return spent;
  }

  toggleChosenSkill(charId, skillKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.chosenSkills) char.chosenSkills = {};
    char.chosenSkills[skillKey] = !char.chosenSkills[skillKey];

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);

    if (!isNew) {
      this.saveCharactersState();
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      if (container) this.renderOfficialSheet(char, container, true);
    }
  }

  adjustSkillRank(charId, skillKey, delta, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.skillRanks) char.skillRanks = {};
    const oldRanks = parseInt(char.skillRanks[skillKey]) || 0;
    let nextRanks = Math.max(0, oldRanks + delta);
    char.skillRanks[skillKey] = nextRanks;

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);

    if (container) {
      const rankInput = container.querySelector(`input[data-path="skillRanks.${skillKey}"]`);
      if (rankInput) rankInput.value = nextRanks;
    }

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    this.recalculateSheetModifiers(char, container);
  }

  renderDmCharacterGeneratorBanner(char = {}) {
    const isDmUser = this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin');
    if (!isDmUser) return '';

    const currentLvl = char.level || 1;
    const currentClass = char.class || 'fighter';
    const currentRace = char.race || 'human';

    return `
      <div class="dm-char-gen-banner">
        <div class="dm-char-gen-header">
          <strong style="color:var(--accent-gold); font-size:0.95rem; display:flex; align-items:center; gap:6px;">
            ⚡ Gerador Automático de Personagem por Nível (Exclusivo do Mestre)
          </strong>
          <span style="font-size:0.72rem; color:var(--text-muted); background:rgba(0,0,0,0.4); padding:2px 8px; border-radius:4px; border:1px solid rgba(212,175,55,0.3); white-space:nowrap;">D&D 3.0 / 3.5</span>
        </div>
        
        <div class="dm-char-gen-grid">
          <div>
            <label class="rpg-label" style="font-size:0.72rem; margin-bottom:4px; display:block; white-space:nowrap;">Nível (1 a 50)</label>
            <input type="number" id="dm-char-gen-level" class="rpg-input" value="${currentLvl}" min="1" max="99" style="height:36px; text-align:center; font-weight:bold; font-size:0.95rem; width:100%; box-sizing:border-box;" placeholder="Nvl">
          </div>
          <div>
            <label class="rpg-label" style="font-size:0.72rem; margin-bottom:4px; display:block; white-space:nowrap;">Classe</label>
            <select id="dm-char-gen-class" class="rpg-select" style="height:36px; font-size:0.82rem; width:100%; padding:4px 6px; box-sizing:border-box;">
              <option value="random">🎲 Aleatória</option>
              <option value="fighter" ${currentClass === 'fighter' ? 'selected' : ''}>🛡️ Guerreiro</option>
              <option value="barbarian" ${currentClass === 'barbarian' ? 'selected' : ''}>🪓 Bárbaro</option>
              <option value="rogue" ${currentClass === 'rogue' ? 'selected' : ''}>🗡️ Ladino</option>
              <option value="ranger" ${currentClass === 'ranger' ? 'selected' : ''}>🏹 Rastreador</option>
              <option value="paladin" ${currentClass === 'paladin' ? 'selected' : ''}>⚔️ Paladino</option>
              <option value="monk" ${currentClass === 'monk' ? 'selected' : ''}>🥋 Monge</option>
              <option value="cleric" ${currentClass === 'cleric' ? 'selected' : ''}>✝️ Clérigo</option>
              <option value="druid" ${currentClass === 'druid' ? 'selected' : ''}>🍃 Druida</option>
              <option value="wizard" ${currentClass === 'wizard' ? 'selected' : ''}>🧙‍♂️ Mago</option>
              <option value="sorcerer" ${currentClass === 'sorcerer' ? 'selected' : ''}>🔮 Feiticeiro</option>
              <option value="bard" ${currentClass === 'bard' ? 'selected' : ''}>🎵 Bardo</option>
            </select>
          </div>
          <div>
            <label class="rpg-label" style="font-size:0.72rem; margin-bottom:4px; display:block; white-space:nowrap;">Raça</label>
            <select id="dm-char-gen-race" class="rpg-select" style="height:36px; font-size:0.82rem; width:100%; padding:4px 6px; box-sizing:border-box;">
              <option value="random">🎲 Aleatória</option>
              <option value="human" ${currentRace === 'human' ? 'selected' : ''}>👤 Humano</option>
              <option value="elf" ${currentRace === 'elf' ? 'selected' : ''}>🧝 Elfo</option>
              <option value="dwarf" ${currentRace === 'dwarf' ? 'selected' : ''}>⛏️ Anão</option>
              <option value="halfling" ${currentRace === 'halfling' ? 'selected' : ''}>🌿 Halfling</option>
              <option value="gnome" ${currentRace === 'gnome' ? 'selected' : ''}>🧪 Gnomo</option>
              <option value="half_elf" ${currentRace === 'half_elf' ? 'selected' : ''}>🧝‍♂️ Meio-Elfo</option>
              <option value="half_orc" ${currentRace === 'half_orc' ? 'selected' : ''}>👹 Meio-Orc</option>
              <option value="half_dragon" ${currentRace === 'half_dragon' ? 'selected' : ''}>🐉 Meio-Dragão</option>
              <option value="aasimar" ${currentRace === 'aasimar' ? 'selected' : ''}>😇 Aasimar</option>
              <option value="tiefling" ${currentRace === 'tiefling' ? 'selected' : ''}>😈 Tiefling</option>
            </select>
          </div>
          <div class="dm-gen-btn-col">
            <button type="button" class="rpg-btn" style="height:36px; padding:0 18px; font-size:0.85rem; font-weight:bold; background: linear-gradient(135deg, var(--accent-gold), #854d0e); white-space:nowrap; display:flex; align-items:center; gap:6px; box-shadow:0 4px 10px rgba(0,0,0,0.3);" onclick="app.generateCharacterByLevel()">
              ⚡ GERAR PERSONAGEM
            </button>
          </div>
        </div>
      </div>
    `;
  }

  generateCharacterByLevel() {
    const isDmUser = this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin');
    if (!isDmUser) {
      this.showToast("Recurso exclusivo para o login de Mestre.");
      return;
    }

    const lvlInput = document.getElementById('dm-char-gen-level');
    let level = parseInt(lvlInput?.value) || 1;
    level = Math.max(1, Math.min(99, level));
    
    const classInput = document.getElementById('dm-char-gen-class');
    let chosenClass = classInput?.value || 'random';
    const classesList = ['fighter', 'barbarian', 'rogue', 'ranger', 'paladin', 'monk', 'cleric', 'druid', 'wizard', 'sorcerer', 'bard'];
    if (chosenClass === 'random' || !classesList.includes(chosenClass)) {
      chosenClass = classesList[Math.floor(Math.random() * classesList.length)];
    }

    const raceInput = document.getElementById('dm-char-gen-race');
    let chosenRace = raceInput?.value || 'random';
    const racesList = ['human', 'elf', 'dwarf', 'halfling', 'gnome', 'half_elf', 'half_orc', 'half_dragon', 'aasimar', 'tiefling'];
    if (chosenRace === 'random' || !racesList.includes(chosenRace)) {
      chosenRace = racesList[Math.floor(Math.random() * racesList.length)];
    }

    const totalXp = level === 1 ? 0 : Math.floor((level * (level - 1) / 2) * 1000);

    const namesByClass = {
      fighter: ['Valeros', 'Kragan', 'Torin', 'Baelor', 'Gareth', 'Durgan', 'Alastor'],
      barbarian: ['Conan', 'Hrothgar', 'Ulfric', 'Torgar', 'Grommash', 'Ragnar', 'Korg'],
      rogue: ['Kaelen', 'Corvo', 'Sylas', 'Vane', 'Jax', 'Locke', 'Shade'],
      ranger: ['Theron', 'Robin', 'Strider', 'Faolan', 'Hawke', 'Elandor', 'Faelar'],
      paladin: ['Arthur', 'Galahad', 'Lancelot', 'Roland', 'Valdemar', 'Lucian', 'Auriel'],
      monk: ['Shen', 'Li Kao', 'Tenzen', 'Boran', 'Kenshiro', 'Mantis', 'Tao'],
      cleric: ['Kharas', 'Benedict', 'Gabriel', 'Theodos', 'Malthus', 'Althaus', 'Gideon'],
      druid: ['Malfurion', 'Rowan', 'Silvanus', 'Bram', 'Faunus', 'Galan', 'Elowen'],
      wizard: ['Elminster', 'Raistlin', 'Mordenkainen', 'Archimonde', 'Ignis', 'Valtiel', 'Azreal'],
      sorcerer: ['Vaelen', 'Ignis Flame', 'Kaiden', 'Draven', 'Zarek', 'Malakor', 'Zephyr'],
      bard: ['Dandelion', 'Orpheus', 'Lyndon', 'Alistair', 'Piper', 'Gildas', 'Taliesin']
    };
    const baseName = namesByClass[chosenClass][Math.floor(Math.random() * namesByClass[chosenClass].length)];
    const epithets = ['de Bravia', 'Lâmina-de-Prata', 'o Valente', 'Vento-da-Noite', 'Guardião da Luz', 'o Implacável', 'Coração-de-Leão', 'Caminhante do Vazio'];
    const epithet = epithets[Math.floor(Math.random() * epithets.length)];
    const charName = `${baseName} ${epithet}`;

    const baseArrays = {
      fighter: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
      barbarian: { str: 17, dex: 14, con: 15, int: 8, wis: 10, cha: 8 },
      rogue: { str: 10, dex: 17, con: 13, int: 14, wis: 12, cha: 12 },
      ranger: { str: 14, dex: 16, con: 13, int: 10, wis: 14, cha: 8 },
      paladin: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 15 },
      monk: { str: 12, dex: 16, con: 14, int: 10, wis: 16, cha: 8 },
      cleric: { str: 14, dex: 8, con: 14, int: 10, wis: 17, cha: 12 },
      druid: { str: 12, dex: 13, con: 14, int: 10, wis: 17, cha: 8 },
      wizard: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 8 },
      sorcerer: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
      bard: { str: 10, dex: 15, con: 12, int: 13, wis: 10, cha: 16 }
    };
    let abilities = Object.assign({}, baseArrays[chosenClass]);
    
    // Level ability boosts: +1 every 4 levels
    const statPoints = Math.floor(level / 4);
    const epicStatBonus = level > 20 ? Math.floor((level - 20) / 2) : 0;
    
    if (chosenClass === 'wizard') { abilities.int += statPoints + epicStatBonus; abilities.con += epicStatBonus; }
    else if (chosenClass === 'sorcerer' || chosenClass === 'bard') { abilities.cha += statPoints + epicStatBonus; abilities.dex += epicStatBonus; }
    else if (chosenClass === 'cleric' || chosenClass === 'druid') { abilities.wis += statPoints + epicStatBonus; abilities.con += epicStatBonus; }
    else if (chosenClass === 'rogue') { abilities.dex += statPoints + epicStatBonus; abilities.int += epicStatBonus; }
    else if (chosenClass === 'monk') { abilities.wis += Math.ceil(statPoints/2) + epicStatBonus; abilities.dex += Math.floor(statPoints/2) + epicStatBonus; }
    else { abilities.str += statPoints + epicStatBonus; abilities.con += epicStatBonus; }

    // Racial modifiers
    const raceObj = window.DND3_RACES ? window.DND3_RACES[chosenRace] : (window.DND3_Races ? window.DND3_Races[chosenRace] : null);
    if (raceObj && raceObj.abilityMods) {
      for (const [attr, mod] of Object.entries(raceObj.abilityMods)) {
        if (abilities[attr] !== undefined) abilities[attr] += mod;
      }
    }

    const hdSize = window.DND3_Classes[chosenClass]?.hd || 10;
    const conMod = Math.floor((abilities.con - 10) / 2);
    const avgRoll = Math.max(1, Math.round(hdSize * 0.6) + conMod);
    const totalHp = Math.max(8, (hdSize + conMod) + (level - 1) * avgRoll);

    const classObj = window.DND3_Classes[chosenClass];
    const babProg = classObj?.babProg || 'good';
    const goodSaves = classObj?.goodSaves || ['fort'];
    
    const standardBab = babProg === 'good' ? Math.min(20, level) : (babProg === 'poor' ? Math.floor(Math.min(20, level) * 0.5) : Math.floor(Math.min(20, level) * 0.75));
    const epicBab = level > 20 ? Math.floor((level - 20 + 1) / 2) : 0;
    const totalBab = standardBab + epicBab;

    const epicSave = level > 20 ? Math.floor((level - 20 + 1) / 2) : 0;
    const getBaseSave = (type) => {
      const isGood = goodSaves.includes(type);
      const base = isGood ? (Math.floor(Math.min(20, level) / 2) + 2) : Math.floor(Math.min(20, level) / 3);
      return base + epicSave;
    };
    const fortBase = getBaseSave('fort');
    const refBase = getBaseSave('ref');
    const willBase = getBaseSave('will');

    const magicItemBonus = Math.min(5, Math.floor(level / 4));
    const epicItemBonus = level > 20 ? Math.min(10, 5 + Math.floor((level - 20) / 5)) : magicItemBonus;
    
    let weapons = [];
    if (chosenClass === 'fighter' || chosenClass === 'barbarian' || chosenClass === 'paladin') {
      weapons.push({
        name: level >= 20 ? "Espada Grande Sagrada Vorpal" : (level >= 10 ? "Espada Grande de Aço Valiriano" : "Espada Grande"),
        attack: "str",
        damageBase: "2d6",
        damageMod: "str",
        critical: "19-20/x2",
        range: "-",
        type: "Cortante",
        notes: level >= 15 ? `+${epicItemBonus} Mágica, Flamejante (+1d6)` : (level >= 5 ? `+${epicItemBonus} Mágica` : "")
      });
      weapons.push({
        name: "Arco Longo Composto",
        attack: "dex",
        damageBase: "1d8",
        damageMod: "str",
        critical: "20/x3",
        range: "33m",
        type: "Perfurante",
        notes: `+${epicItemBonus} Mágico`
      });
    } else if (chosenClass === 'rogue' || chosenClass === 'ranger' || chosenClass === 'bard') {
      weapons.push({
        name: level >= 20 ? "Florete das Sombras Vorpal" : "Florete Élfico",
        attack: "dex",
        damageBase: "1d6",
        damageMod: "str",
        critical: "18-20/x2",
        range: "-",
        type: "Perfurante",
        notes: `Acuidade com Arma, +${epicItemBonus} Mágico`
      });
      weapons.push({
        name: "Arco Curto Veloz",
        attack: "dex",
        damageBase: "1d6",
        damageMod: "str",
        critical: "20/x3",
        range: "21m",
        type: "Perfurante",
        notes: `+${epicItemBonus} Mágico`
      });
    } else if (chosenClass === 'cleric' || chosenClass === 'druid') {
      weapons.push({
        name: level >= 15 ? "Maça Pesada da Glória Sagrada" : "Maça Pesada",
        attack: "str",
        damageBase: "1d8",
        damageMod: "str",
        critical: "20/x2",
        range: "-",
        type: "Contusão",
        notes: `+${epicItemBonus} Sagrada (+2d6 vs Mortos-Vivos)`
      });
      weapons.push({
        name: "Besta Pesada Encantada",
        attack: "dex",
        damageBase: "1d10",
        damageMod: "none",
        critical: "19-20/x2",
        range: "36m",
        type: "Perfurante",
        notes: `+${epicItemBonus} Mágica`
      });
    } else if (chosenClass === 'monk') {
      weapons.push({
        name: "Golpe Desarmado",
        attack: "str",
        damageBase: level >= 20 ? "2d10" : (level >= 12 ? "2d6" : (level >= 4 ? "1d8" : "1d6")),
        damageMod: "str",
        critical: "20/x2",
        range: "-",
        type: "Contusão",
        notes: `Ataque Chi, +${epicItemBonus} Mágico`
      });
    } else { // Wizard / Sorcerer
      weapons.push({
        name: level >= 20 ? "Cajado do Arquimago Maior" : "Cajado de Defesa",
        attack: "str",
        damageBase: "1d6",
        damageMod: "str",
        critical: "20/x2",
        range: "-",
        type: "Contusão",
        notes: `+${epicItemBonus} Conjurador (+2 CD de Magias)`
      });
      weapons.push({
        name: "Adaga Cerimonial de Prata",
        attack: "dex",
        damageBase: "1d4",
        damageMod: "str",
        critical: "19-20/x2",
        range: "3m",
        type: "Perfurante",
        notes: `+${epicItemBonus} Mágica`
      });
    }

    // Armor and Defenses
    let acArmor = 0;
    let acShield = 0;
    let acNatural = 0;
    if (chosenClass === 'fighter' || chosenClass === 'paladin') {
      acArmor = 8 + epicItemBonus;
      acShield = 2 + (epicItemBonus > 0 ? 1 : 0);
    } else if (chosenClass === 'barbarian' || chosenClass === 'ranger' || chosenClass === 'cleric') {
      acArmor = 5 + epicItemBonus;
      if (chosenClass === 'cleric') acShield = 2;
    } else if (chosenClass === 'rogue' || chosenClass === 'bard' || chosenClass === 'druid') {
      acArmor = 3 + epicItemBonus;
    } else {
      acArmor = epicItemBonus;
    }
    if (chosenRace === 'half_dragon') acNatural = 4;
    else if (chosenRace === 'dwarf') acNatural = 1;

    // Feats text
    let feats = ["Iniciativa Aprimorada", "Esquiva", "Vontade de Ferro"];
    if (chosenClass === 'fighter' || chosenClass === 'barbarian' || chosenClass === 'paladin') {
      feats.push("Ataque Poderoso", "Foco em Arma", "Especialização em Arma", "Trespassar", "Trespassar Aprimorado", "Crítico Aprimorado");
    } else if (chosenClass === 'rogue' || chosenClass === 'ranger') {
      feats.push("Acuidade com Arma", "Tiro Certeiro", "Tiro Preciso", "Mobilidade", "Ataque em Movimento", "Evasão Aprimorada");
    } else if (chosenClass === 'wizard' || chosenClass === 'sorcerer' || chosenClass === 'cleric' || chosenClass === 'druid') {
      feats.push("Foco em Magia", "Magia Penetrante", "Potencializar Magia", "Maximizar Magia", "Acelerar Magia", "Magia Silenciosa");
    } else {
      feats.push("Reflexos Rápidos", "Luta às Cegas", "Mobilidade", "Golpe Estonteante");
    }
    if (level >= 21) feats.push("Talento Épico: Vitalidade Épica (+30 PV)", "Talento Épico: Prontidão Marcial Épica");
    if (level >= 30) feats.push("Talento Épico: Conjuração Épica", "Talento Épico: Velocidade Cegante");

    // Spells Text if caster
    let spellsText = "";
    if (['wizard', 'sorcerer', 'cleric', 'druid', 'bard', 'paladin', 'ranger'].includes(chosenClass)) {
      let spellsLines = [];
      if (level >= 1) spellsLines.push("• 0º Círculo: Ler Magias, Detectar Magia, Luz, Raio de Gelo / Curar Ferimentos Mínimos");
      if (level >= 1) spellsLines.push("• 1º Círculo: Mísseis Mágicos, Escudo Arcano, Curar Ferimentos Leves, Bênção, Queda Suave");
      if (level >= 3) spellsLines.push("• 2º Círculo: Força do Touro, Invisibilidade, Reflexos de Gato, Teia, Restauração Menor");
      if (level >= 5) spellsLines.push("• 3º Círculo: Bola de Fogo, Velocidade, Dissipar Magia, Relâmpago, Oração");
      if (level >= 7) spellsLines.push("• 4º Círculo: Porta Dimensional, Muralha de Fogo, Pele Rochosa, Poder Divino");
      if (level >= 9) spellsLines.push("• 5º Círculo: Cone Glacial, Teletransporte, Muralha de Força, Coluna de Chamas");
      if (level >= 11) spellsLines.push("• 6º Círculo: Desintegração, Dissipar Magia Maior, Visão da Verdade, Cura Completa");
      if (level >= 13) spellsLines.push("• 7º Círculo: Dedo da Morte, Teletransporte Maior, Espada de Mordenkainen, Regeneração");
      if (level >= 15) spellsLines.push("• 8º Círculo: Mente em Branco, Labirinto, Raio Polar, Terremoto");
      if (level >= 17) spellsLines.push("• 9º Círculo: Parar o Tempo, Chuva de Meteoros, Desejo, Implosão, Portal");
      if (level >= 21) spellsLines.push("• Nível Épico (21+): Ruína Épica, Julgamento Final Épico, Eclipse Arcano Maior");
      spellsText = spellsLines.join('\n');
    }

    const goldByLevel = Math.max(100, Math.floor(totalXp * 0.15) + 500);
    const inventoryText = `Kit de Aventureiro, 5x Poções de Cura Maior (${level >= 15 ? 'Cura Completa' : 'Curar Ferimentos Graves'}), Anel de Proteção +${magicItemBonus || 1}, Manto de Resistência +${magicItemBonus || 1}, Mochila de Carga.`;

    const skillRanks = {};
    const maxRank = level + 3;
    if (chosenClass === 'rogue') {
      skillRanks['hide'] = maxRank; skillRanks['move_silently'] = maxRank;
      skillRanks['open_lock'] = maxRank; skillRanks['tumble'] = maxRank;
      skillRanks['search'] = maxRank; skillRanks['spot'] = maxRank;
    } else if (chosenClass === 'wizard' || chosenClass === 'sorcerer') {
      skillRanks['spellcraft'] = maxRank; skillRanks['knowledge_arcana'] = maxRank;
      skillRanks['concentration'] = maxRank;
    } else if (chosenClass === 'cleric' || chosenClass === 'druid') {
      skillRanks['heal'] = maxRank; skillRanks['knowledge_religion'] = maxRank;
      skillRanks['concentration'] = maxRank; skillRanks['spellcraft'] = maxRank;
    } else {
      skillRanks['climb'] = maxRank; skillRanks['jump'] = maxRank;
      skillRanks['swim'] = Math.floor(maxRank/2); skillRanks['intimidate'] = maxRank;
    }

    // Automatic Avatar selection based on class & race
    let avatarUrl = `img/heroes/${chosenClass}.svg`;
    if (chosenRace === 'half_dragon') avatarUrl = 'img/heroes/half_dragon.svg';
    else if (chosenRace === 'tiefling') avatarUrl = 'img/heroes/tiefling.svg';
    else if (chosenRace === 'aasimar') avatarUrl = 'img/heroes/aasimar.svg';

    this.newChar = {
      id: "char_" + Date.now(),
      name: charName,
      player: this.currentUser ? this.currentUser.username : "Mestre",
      gender: Math.random() > 0.5 ? "Masculino" : "Feminino",
      race: chosenRace,
      class: chosenClass,
      alignment: ['lg', 'ng', 'cg', 'ln', 'tn', 'cn', 'le', 'ne', 'ce'][Math.floor(Math.random() * 9)],
      level: level,
      xp: totalXp,
      xpSessions: [{ sessionName: `Geração pelo Mestre (Nvl ${level})`, xpAmt: totalXp }],
      deity: chosenClass === 'cleric' || chosenClass === 'paladin' ? "Heironeous / Pelor" : "",
      size: raceObj?.size || "Médio",
      age: "28",
      height: "1.78m",
      weight: "78kg",
      eyes: "Castanhos",
      hair: "Preto",
      skin: "Clara",
      abilitiesBase: abilities,
      abilitiesTemp: { str: "", dex: "", con: "", int: "", wis: "", cha: "" },
      hpMax: totalHp,
      currentHp: totalHp,
      dr: level >= 20 ? "10/Épico" : (chosenClass === 'barbarian' ? `${Math.floor(level/3)}/-` : ""),
      initiativeMods: [],
      initiativeMisc: 0,
      acArmor: acArmor,
      acShield: acShield,
      acNatural: acNatural,
      acDeflection: Math.min(5, Math.floor(level / 5)),
      acMisc: 0,
      acSize: 0,
      saveFortBase: fortBase,
      saveFortMagic: magicItemBonus,
      saveFortMisc: 0,
      saveFortTemp: 0,
      saveRefBase: refBase,
      saveRefMagic: magicItemBonus,
      saveRefMisc: 0,
      saveRefTemp: 0,
      saveWillBase: willBase,
      saveWillMagic: magicItemBonus,
      saveWillMisc: 0,
      saveWillTemp: 0,
      bab: totalBab,
      sr: (level >= 15 || chosenRace === 'drow') ? (11 + level) : 0,
      grappleSize: 0,
      grappleMisc: 0,
      weapons: weapons,
      skillRanks: skillRanks,
      skillMisc: {},
      featsText: feats.join(', '),
      customFeats: [],
      customAbilities: [],
      languages: ["Comum", (raceObj && raceObj.languages) ? raceObj.languages[0] : "Élfico"],
      inventoryText: inventoryText,
      coins: { gp: goldByLevel, pp: 0, sp: 0, cp: 0 },
      spellsText: spellsText,
      notes: `Personagem gerado automaticamente pelo Mestre para o Nível ${level}.`,
      avatar: avatarUrl,
      owner: this.currentUser ? this.currentUser.username : "Mestre",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    this.creatorStep = 'sheet';
    this.normalizeCharacter(this.newChar, true);
    localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    
    this.renderNewCharacterSheet();
    const className = window.DND3_Classes[chosenClass]?.name || chosenClass;
    const raceName = raceObj?.name || chosenRace;
    this.showToast(`⚡ Personagem <strong>${charName}</strong> (${className} ${raceName} Nvl ${level}) gerado com sucesso pelo Mestre!`);
  }

  renderNewCharacterSheet() {
    const draft = localStorage.getItem('dnd3_new_char');
    if (draft) {
      this.newChar = JSON.parse(draft);
    } else {
      this.resetNewChar();
    }
    
    const container = document.getElementById('official-sheet-creator-container');
    if (!container) return;

    const isDmUser = this.currentUser && (this.normalizeRole(this.currentUser.role) === 'dm' || this.normalizeRole(this.currentUser.role) === 'admin');

    if (isDmUser) {
      this.creatorStep = 'sheet';
    } else if (!this.creatorStep) {
      this.creatorStep = 'photo';
    }

    if (this.creatorStep === 'photo' && !isDmUser) {
      const avatarHtml = this.newChar.avatar ? 
        `<img src="${this.newChar.avatar}" style="width:100%; height:100%; object-fit:cover;">` :
        `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:rgba(170,124,17,0.6);">
           <span style="font-size:5rem;">👤</span>
           <span style="font-family:'Cinzel', serif; font-size:1.1rem; font-weight:bold; margin-top:10px;">Adicionar Foto do Personagem</span>
           <span style="font-size:0.8rem; color:#777; margin-top:5px;">(Clique para fazer upload)</span>
         </div>`;

      container.innerHTML = `
        <div class="creator-photo-step-container" style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; max-width:600px; margin:0 auto; padding:2rem; box-sizing:border-box;">
          <h2 style="font-family:'Cinzel', serif; color:#5a3e09; text-align:center; margin-bottom:1.5rem; letter-spacing:0.05em;">Criação de Personagem - Imagem</h2>
          
          <div class="creator-portrait-uploader" style="width:100%; max-width:400px; height:450px; border:3px dashed rgba(170,124,17,0.5); border-radius:12px; background:rgba(0,0,0,0.02); cursor:pointer; position:relative; overflow:hidden; box-sizing:border-box; transition:all 0.2s;" onclick="this.querySelector('input').click()">
            ${avatarHtml}
            <input type="file" accept="image/*" style="display:none;" onchange="app.handleAvatarUpload(event, '${this.newChar.id}', true)">
          </div>
          
          <div style="display:flex; flex-direction:column; gap:12px; width:100%; max-width:400px; margin-top:1.5rem;">
            <button class="rpg-btn" style="width:100%; height:50px; font-size:1.1rem; font-weight:bold; background:#5a3e09; color:#fdfaf2; border-color:#5a3e09; font-family:'Cinzel', serif; box-shadow:0 4px 10px rgba(90,62,9,0.3);" onclick="app.proceedToSheetCreator()">
              Preencher Ficha Manualmente 📜
            </button>
            
            <div style="display:flex; align-items:center; gap:10px; color:#888; font-size:0.8rem; margin:4px 0;">
              <div style="flex:1; height:1px; background:rgba(170,124,17,0.3);"></div>
              <span>OU</span>
              <div style="flex:1; height:1px; background:rgba(170,124,17,0.3);"></div>
            </div>

            <label class="rpg-btn" style="width:100%; height:46px; font-size:0.95rem; font-weight:bold; background:linear-gradient(135deg, #1e40af, #2563eb); border-color:#1d4ed8; color:#ffffff; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; border-radius:4px; box-shadow:0 4px 10px rgba(37,99,235,0.25); box-sizing:border-box; margin:0;">
              📥 Importar Ficha do Excel (.xlsx)
              <input type="file" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none;" onchange="app.importCharacterFromExcel(event)">
            </label>
          </div>
        </div>
      `;
    } else {
      this.renderOfficialSheet(this.newChar, container, true);
    }
  }

  proceedToSheetCreator() {
    this.creatorStep = 'sheet';
    this.renderNewCharacterSheet();
  }

  addTempWeaponToList(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nameInput = document.getElementById('temp-weapon-name');
    const attackSelect = document.getElementById('temp-weapon-attack');
    const baseSelect = document.getElementById('temp-weapon-damageBase');
    const modSelect = document.getElementById('temp-weapon-damageMod');
    const critSelect = document.getElementById('temp-weapon-critical');
    const rangeSelect = document.getElementById('temp-weapon-range');
    const typeSelect = document.getElementById('temp-weapon-type');
    const notesInput = document.getElementById('temp-weapon-notes');

    if (!nameInput || !nameInput.value.trim()) {
      this.showToast("Por favor, preencha o Nome do Equipamento.");
      return;
    }

    const newW = {
      name: nameInput.value.trim(),
      attack: attackSelect ? attackSelect.value : '',
      damageBase: baseSelect ? baseSelect.value : '',
      damageMod: modSelect ? modSelect.value : '',
      critical: critSelect ? critSelect.value : '',
      range: rangeSelect ? rangeSelect.value : '',
      type: typeSelect ? typeSelect.value : '',
      notes: notesInput ? notesInput.value.trim() : ''
    };

    if (!char.weapons) char.weapons = [];
    char.weapons.push(newW);

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast(`Arma "${newW.name}" adicionada ao inventário!`);
  }

  deleteWeaponFromInventory(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;



    char.weapons.splice(idx, 1);

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Arma removida do inventário.");
  }

  addCustomFeat(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nameInput = document.getElementById('sheet-custom-feat-name');
    const benefitInput = document.getElementById('sheet-custom-feat-benefit');
    if (!nameInput || !nameInput.value.trim()) {
      this.showToast("Por favor, preencha o Nome do Talento Personalizado.");
      return;
    }

    if (!char.customFeats) char.customFeats = [];
    char.customFeats.push({
      name: nameInput.value.trim(),
      benefit: benefitInput ? benefitInput.value.trim() : ''
    });

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Talento personalizado adicionado!");
  }

  deleteCustomFeat(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.customFeats) {
      char.customFeats.splice(idx, 1);
    }

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Talento personalizado removido.");
  }

  addCustomAbility(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nameInput = document.getElementById('sheet-custom-ability-name');
    const benefitInput = document.getElementById('sheet-custom-ability-benefit');
    if (!nameInput || !nameInput.value.trim()) {
      this.showToast("Por favor, preencha o Nome da Habilidade.");
      return;
    }

    if (!char.customAbilities) char.customAbilities = [];
    char.customAbilities.push({
      name: nameInput.value.trim(),
      benefit: benefitInput ? benefitInput.value.trim() : ''
    });

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Habilidade personalizada adicionada!");
  }

  deleteCustomAbility(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.customAbilities) {
      char.customAbilities.splice(idx, 1);
    }

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Habilidade personalizada removida.");
  }

  addInitiativeMod(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const descInput = document.getElementById('temp-init-desc');
    const valInput = document.getElementById('temp-init-val');
    if (!descInput || !descInput.value.trim()) {
      this.showToast("Por favor, insira a descrição do modificador.");
      return;
    }

    const val = parseInt(valInput ? valInput.value : 0) || 0;

    if (!char.initiativeMods) char.initiativeMods = [];
    char.initiativeMods.push({
      desc: descInput.value.trim(),
      val: val
    });

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Modificador de iniciativa adicionado!");
  }

  deleteInitiativeMod(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.initiativeMods) {
      char.initiativeMods.splice(idx, 1);
    }

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Modificador removido.");
  }

  addBackpackItem(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const nameInput = document.getElementById('temp-bag-item-name');
    const weightInput = document.getElementById('temp-bag-item-weight');
    const qtyInput = document.getElementById('temp-bag-item-qty');

    if (!nameInput || !nameInput.value.trim()) {
      this.showToast("Por favor, preencha o Nome do Item.");
      return;
    }

    const newItem = {
      name: nameInput.value.trim(),
      weight: parseFloat(weightInput ? weightInput.value : 0) || 0,
      qty: parseInt(qtyInput ? qtyInput.value : 1) || 1
    };

    if (!char.inventoryItems) char.inventoryItems = [];
    char.inventoryItems.push(newItem);

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast(`Item "${newItem.name}" adicionado à mochila!`);
  }

  deleteBackpackItem(charId, idx, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.inventoryItems) {
      char.inventoryItems.splice(idx, 1);
    }

    if (!isNew) {
      this.saveCharactersState();
      const container = document.getElementById('sheet-detail-view');
      if (container) this.renderCharacterSheetDetails(char, container);
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    }
    this.showToast("Item removido da mochila.");
  }

  saveBackpackNotes(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const textarea = document.getElementById('sheet-bag-notes-textarea');
    if (textarea) {
      char.inventoryText = textarea.value;
    }

    if (!isNew) {
      this.saveCharactersState();
      this.showToast("Notas da mochila salvas!");
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.showToast("Notas da mochila salvas no rascunho!");
    }
  }

  calculateTotalCarriedWeight(char) {
    let total = 0;

    // 1. Modular Armor Parts and Shields
    if (char.equippedArmorParts) {
      char.equippedArmorParts.forEach(p => {
        total += parseFloat(p.weight) || 0;
      });
    }

    // 2. Backpack Items
    if (char.inventoryItems) {
      char.inventoryItems.forEach(item => {
        total += (parseFloat(item.weight) || 0) * (parseInt(item.qty) || 1);
      });
    }

    // 3. Weapons
    if (char.weapons) {
      char.weapons.forEach(w => {
        let wWeight = parseFloat(w.weight);
        if (isNaN(wWeight)) {
          const nameLower = (w.name || "").toLowerCase();
          if (nameLower.includes("adaga") || nameLower.includes("dagger")) wWeight = 1.0;
          else if (nameLower.includes("arco") || nameLower.includes("bow")) wWeight = 2.5;
          else if (nameLower.includes("espada larga") || nameLower.includes("greatsword")) wWeight = 15.0;
          else if (nameLower.includes("machado grande") || nameLower.includes("greataxe")) wWeight = 20.0;
          else if (nameLower.includes("espada") || nameLower.includes("sword") || nameLower.includes("rapier") || nameLower.includes("axe")) wWeight = 4.0;
          else wWeight = 2.0; // Standard fallback
        }
        total += wWeight;
      });
    }

    return total.toFixed(1).replace('.', ',');
  }

  filterModularArmorSelect(charId, isNewChar) {
    const input = document.getElementById('sheet-armor-search');
    const select = document.getElementById('sheet-armor-part-select');
    if (!input || !select) return;

    const q = input.value.toLowerCase();
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    let html = '<option value="">-- Escolher Peça de Armadura/Escudo --</option>';
    if (window.DND3_ModularArmorParts) {
      Object.keys(window.DND3_ModularArmorParts).forEach(k => {
        const p = window.DND3_ModularArmorParts[k];
        
        // Filter out equipped parts
        const isEquipped = (char.equippedArmorParts || []).some(ep => ep.key === k);
        if (isEquipped) return;

        // Filter by query
        const nameMatch = p.name.toLowerCase().includes(q);
        const typeMatch = p.partType.toLowerCase().includes(q);
        if (!nameMatch && !typeMatch) return;

        let attrText = "";
        if (p.attrMods) {
          const mods = Object.keys(p.attrMods).map(a => `${a.toUpperCase()} ${p.attrMods[a] > 0 ? '+' + p.attrMods[a] : p.attrMods[a]}`);
          attrText = ` | Mod: ${mods.join(', ')}`;
        }
        let specsText = "";
        if (p.partType === 'Arma') {
          specsText = `Dano ${p.damageBase || '1d6'}${p.attack ? ', Atk ' + p.attack : ''}`;
        } else {
          specsText = `CA +${p.acBonus || 0}${p.penalty ? ', Pen ' + p.penalty : ''}`;
        }
        html += `<option value="${k}">[${p.partType}] ${p.name} (${specsText}${attrText})</option>`;
      });
    }
    
    select.innerHTML = html;
  }

  getWeaponDeityAttackBonus(char, weaponName) {
    if (!char || !char.deity || !weaponName || !window.DND3_Deities || !window.DND3_Deities[char.deity]) return 0;
    const dObj = window.DND3_Deities[char.deity];
    if (dObj.bonusType === 'weapon_attack' && dObj.weaponPattern && dObj.weaponPattern.test(weaponName)) {
      return dObj.bonusVal;
    }
    return 0;
  }

  getWeaponDeityDamageBonus(char, weaponName) {
    if (!char || !char.deity || !weaponName || !window.DND3_Deities || !window.DND3_Deities[char.deity]) return 0;
    const dObj = window.DND3_Deities[char.deity];
    if (dObj.bonusType === 'weapon_damage' && dObj.weaponPattern && dObj.weaponPattern.test(weaponName)) {
      return dObj.bonusVal;
    }
    return 0;
  }

  switchSheetSubtab(tabId, element) {
    this.activeSheetSubtab = tabId;
    let container = element ? element.closest('.dnd-sheet-container') : null;
    
    if (!container) {
      const detailView = document.getElementById('sheet-detail-view');
      const creatorView = document.getElementById('official-sheet-creator-container');
      if (detailView && detailView.style.display !== 'none' && detailView.innerHTML !== '') {
        container = detailView;
      } else if (creatorView && creatorView.innerHTML !== '') {
        container = creatorView;
      }
    }
    
    if (container) {
      container.querySelectorAll('.sheet-sub-tab-content').forEach(el => {
        el.style.display = 'none';
      });
      container.querySelectorAll('.sheet-sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      const activeSection = container.querySelector(`#sheet-sec-${tabId}`);
      if (activeSection) activeSection.style.display = 'block';
      
      const activeBtn = container.querySelector(`#sheet-btn-${tabId}`);
      if (activeBtn) activeBtn.classList.add('active');
    }
  }

  handleSheetInputChange(event, char, isNewChar) {
    const target = event.target;
    const path = target.dataset.path;
    if (!path) return;
    
    const parts = path.split('.');
    let val = (target.type === 'number' && target.value !== '') ? (parseInt(target.value) || 0) : target.value;
    if (target.type === 'checkbox') {
      val = target.checked;
    }
    
    const isNew = isNewChar === true || isNewChar === 'true';
    const activeChar = isNew ? this.newChar : this.savedCharacters.find(c => c.id === char.id);
    if (!activeChar) return;
    
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);

    if (parts.length === 1) {
      if (parts[0] === 'hpMax') {
        const rawVal = target.value ? target.value.trim() : '';
        if (event.type === 'input') {
          if (rawVal !== '') {
            const parsed = parseInt(rawVal);
            if (!isNaN(parsed) && parsed >= 0) {
              activeChar.hpMax = parsed;
            }
          }
          return;
        }
        // on 'change' / 'blur':
        const finalHpMax = Math.max(1, parseInt(rawVal) || 1);
        activeChar.hpMax = finalHpMax;
        target.value = finalHpMax;
        if (activeChar.currentHp > finalHpMax || activeChar.currentHp === undefined) {
          activeChar.currentHp = finalHpMax;
          const curInput = container ? container.querySelector('#sheet-hp-current') : null;
          if (curInput && document.activeElement !== curInput) curInput.value = finalHpMax;
        }
        if (!isNew) this.saveCharactersState();
        return;
      }
      if (parts[0] === 'currentHp') {
        const rawVal = target.value ? target.value.trim() : '';
        if (event.type === 'input') {
          if (rawVal !== '') {
            const parsed = parseInt(rawVal);
            if (!isNaN(parsed)) {
              activeChar.currentHp = parsed;
            }
          }
          return;
        }
        // on 'change' / 'blur':
        const finalCurHp = parseInt(rawVal) || 0;
        activeChar.currentHp = finalCurHp;
        target.value = finalCurHp;
        if (!isNew) this.saveCharactersState();
        return;
      }
      if (parts[0] === 'cr') {
        const rawVal = target.value ? target.value.trim() : '';
        if (event.type === 'input') {
          if (rawVal !== '') {
            const parsed = parseInt(rawVal);
            if (!isNaN(parsed) && parsed > 0) {
              activeChar.cr = parsed;
            }
          }
          return;
        }
        // on 'change' / 'blur':
        const finalCR = Math.max(1, parseInt(rawVal) || 1);
        activeChar.cr = finalCR;
        target.value = finalCR;
        if (!isNew) this.saveCharactersState();
        return;
      }
      if (parts[0] === 'xp') {
        if (event.type === 'input') return; // Ignore input events to avoid resetting value during typing!
        const oldXp = activeChar.xp || 0;
        const newXp = val || 0;
        const diff = newXp - oldXp;
        
        if (diff !== 0) {
          if (!activeChar.xpSessions) activeChar.xpSessions = [];
          const currentDate = new Date().toLocaleDateString('pt-BR');
          activeChar.xpSessions.push({
            sessionName: `Ajuste de XP (${currentDate})`,
            xpAmt: diff
          });
          if (!isNew) {
            this.logAction(`Ajustou XP de ${activeChar.name}: ${oldXp} -> ${newXp}`);
          }
        }
        activeChar.xp = newXp;
      } else {
        const oldVal = activeChar[parts[0]];
        activeChar[parts[0]] = val;
        if (event.type === 'change' && !isNew && oldVal !== val) {
          this.logAction(`Alterou '${parts[0]}' de ${activeChar.name}: '${oldVal}' -> '${val}'`);
        }
      }

      if (parts[0] === 'race') {
        const rc = window.DND3_Races[val];
        if (rc) {
          activeChar.size = rc.size;
          this.normalizeCharacter(activeChar);
          if (container) {
            setTimeout(() => {
              if (isNew) {
                this.renderOfficialSheet(activeChar, container, true);
              } else {
                this.renderCharacterSheetDetails(activeChar, container);
              }
            }, 0);
          }
        }
      }

      if (parts[0] === 'size') {
        const sizeMap = {
          'Fine': -10,
          'Diminutive': -10,
          'Tiny': -8,
          'Small': -4,
          'Medium': 0,
          'Large': 8,
          'Huge': 16,
          'Gargantuan': 24,
          'Colossal': 32
        };
        const dexMap = {
          'Fine': 8,
          'Diminutive': 6,
          'Tiny': 4,
          'Small': 2,
          'Medium': 0,
          'Large': -2,
          'Huge': -4,
          'Gargantuan': -4,
          'Colossal': -4
        };
        const conMap = {
          'Fine': -2,
          'Diminutive': -2,
          'Tiny': -2,
          'Small': -2,
          'Medium': 0,
          'Large': 4,
          'Huge': 8,
          'Gargantuan': 12,
          'Colossal': 16
        };
        const strOffset = sizeMap[val] !== undefined ? sizeMap[val] : 0;
        const dexOffset = dexMap[val] !== undefined ? dexMap[val] : 0;
        const conOffset = conMap[val] !== undefined ? conMap[val] : 0;

        if (!activeChar.abilitiesTemp) activeChar.abilitiesTemp = {};
        activeChar.abilitiesTemp.str = strOffset;
        activeChar.abilitiesTemp.dex = dexOffset;
        activeChar.abilitiesTemp.con = conOffset;

        if (container) {
          const strTempInput = container.querySelector('input[data-path="abilitiesTemp.str"]');
          if (strTempInput) strTempInput.value = strOffset;
          const dexTempInput = container.querySelector('input[data-path="abilitiesTemp.dex"]');
          if (dexTempInput) dexTempInput.value = dexOffset;
          const conTempInput = container.querySelector('input[data-path="abilitiesTemp.con"]');
          if (conTempInput) conTempInput.value = conOffset;
        }
      }

      if (parts[0] === 'xp' || parts[0] === 'class') {
        const oldLevel = activeChar.level || 1;
        this.normalizeCharacter(activeChar);
        const newLevel = activeChar.level || 1;
        
        const shouldReRender = (parts[0] === 'class') || (newLevel !== oldLevel);
        
        if (shouldReRender && container) {
          setTimeout(() => {
            if (isNew) {
              this.renderOfficialSheet(activeChar, container, true);
            } else {
              this.renderCharacterSheetDetails(activeChar, container);
            }
          }, 0);
        }
        
        // Synchronize fields in UI
        if (container) {
          const levelInput = container.querySelector('input[data-path="level"]');
          if (levelInput) levelInput.value = activeChar.level;

          const babInput = container.querySelector('input[data-path="bab"]');
          if (babInput) babInput.value = activeChar.bab;

          const fortInput = container.querySelector('input[data-path="saveFortBase"]');
          if (fortInput) fortInput.value = activeChar.saveFortBase;

          const refInput = container.querySelector('input[data-path="saveRefBase"]');
          if (refInput) refInput.value = activeChar.saveRefBase;

          const willInput = container.querySelector('input[data-path="saveWillBase"]');
          if (willInput) willInput.value = activeChar.saveWillBase;
        }
      }
    } else if (parts.length === 2) {
      if (!activeChar[parts[0]]) activeChar[parts[0]] = {};
      const oldVal = activeChar[parts[0]][parts[1]];
      if (parts[0] === 'abilitiesBase') {
        const rc = window.DND3_Races[activeChar.race] || { modifiers: {} };
        const raceMod = parseInt(rc.modifiers?.[parts[1]]) || 0;
        const lvlUpMod = parseInt(activeChar.levelUpAttributes?.[parts[1]]) || 0;
        const numericVal = parseInt(val) || 10;
        activeChar[parts[0]][parts[1]] = numericVal - raceMod - lvlUpMod;
      } else if (parts[0] === 'skillRanks') {
        const numericVal = Math.max(0, parseInt(val) || 0);
        activeChar[parts[0]][parts[1]] = numericVal;
      } else if (parts[0] === 'skillMisc') {
        const racialBonus = (window.DND3_RacialSkillBonuses && window.DND3_RacialSkillBonuses[activeChar.race] && window.DND3_RacialSkillBonuses[activeChar.race][parts[1]]) ? window.DND3_RacialSkillBonuses[activeChar.race][parts[1]] : 0;
        const numericVal = parseInt(val) || 0;
        activeChar[parts[0]][parts[1]] = numericVal - racialBonus;
      } else {
        activeChar[parts[0]][parts[1]] = val;
      }
      if (event.type === 'change' && !isNew && oldVal !== activeChar[parts[0]][parts[1]]) {
        this.logAction(`Alterou '${parts[0]}.${parts[1]}' de ${activeChar.name}: '${oldVal}' -> '${activeChar[parts[0]][parts[1]]}'`);
      }
    } else if (parts.length === 3) {
      if (!activeChar[parts[0]]) activeChar[parts[0]] = {};
      if (!activeChar[parts[0]][parts[1]]) activeChar[parts[0]][parts[1]] = {};
      const oldVal = activeChar[parts[0]][parts[1]][parts[2]];
      activeChar[parts[0]][parts[1]][parts[2]] = val;

      if (event.type === 'change' && !isNew && oldVal !== val) {
        this.logAction(`Alterou '${parts[0]}.${parts[1]}.${parts[2]}' de ${activeChar.name}: '${oldVal}' -> '${val}'`);
      }

      // Sync weapons.idx.damage when damageBase or damageMod changes
      if (parts[0] === 'weapons' && (parts[2] === 'damageBase' || parts[2] === 'damageMod')) {
        const wIdx = parseInt(parts[1]);
        const w = activeChar.weapons[wIdx];
        const base = w.damageBase || '';
        const mod = w.damageMod || '';
        w.damage = base + (mod && mod !== '+0' ? (mod.startsWith('+') || mod.startsWith('-') ? mod : '+' + mod) : '');
      }
    }
    
    this.recalculateSheetModifiers(activeChar, container);
    
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }
  }

  handleAvatarUpload(event, charId, isNewChar) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem selecionada é muito grande! Por favor, escolha uma imagem de até 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        } else {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }

        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;
        const ctx = canvas.getContext('2d');
        
        const xOffset = (MAX_WIDTH - width) / 2;
        const yOffset = (MAX_HEIGHT - height) / 2;
        ctx.drawImage(img, xOffset, yOffset, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        if (isNewChar === true || isNewChar === 'true') {
          this.newChar.avatar = dataUrl;
          localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
          this.renderNewCharacterSheet();
        } else {
          const char = this.savedCharacters.find(c => c.id === charId);
          if (char) {
            char.avatar = dataUrl;
            this.saveCharactersState();
            const container = document.getElementById('sheet-detail-view');
            if (container) this.renderOfficialSheet(char, container, false);
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  filterSheetFeatsList(query, charId, isNewChar) {
    const q = (query || "").toLowerCase().trim();
    const select = document.getElementById('sheet-feat-select');
    if (!select) return;

    const char = (isNewChar === true || isNewChar === 'true') ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.feats) char.feats = [];

    let html = ['<option value="">-- Escolha um Talento --</option>'];
    for (let k in window.DND3_Feats) {
      const feat = window.DND3_Feats[k];
      const isAlreadyAdded = char.feats.includes(k);
      const matchesQuery = feat.name.toLowerCase().includes(q) || feat.benefit.toLowerCase().includes(q) || feat.description.toLowerCase().includes(q);

      if (matchesQuery) {
        html.push(`<option value="${k}" ${isAlreadyAdded ? 'disabled' : ''}>${feat.name} ${isAlreadyAdded ? '(Já Adicionado)' : ''}</option>`);
      }
    }
    select.innerHTML = html.join('');
  }

  addFeatFromSheet(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const select = container.querySelector('#sheet-feat-select');
    if (!select) return;

    const featKey = select.value;
    if (!featKey) {
      alert("Por favor, selecione um talento válido da lista.");
      return;
    }

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.feats) char.feats = [];

    if (char.feats.includes(featKey)) {
      alert("Este talento já foi adicionado.");
      return;
    }

    char.feats.push(featKey);

    if (isNew) {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    } else {
      this.saveCharactersState();
      this.renderOfficialSheet(char, container, false);
    }

    this.showToast(`Talento "${window.DND3_Feats[featKey].name}" adicionado!`);
  }

  removeFeatFromSheet(charId, featKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.feats) char.feats = [];

    char.feats = char.feats.filter(f => f !== featKey);

    if (isNew) {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    } else {
      this.saveCharactersState();
      this.renderOfficialSheet(char, container, false);
    }

    this.showToast(`Talento removido.`);
  }

  filterSheetAbilitiesList(query, charId, isNewChar) {
    const q = (query || "").toLowerCase().trim();
    const select = document.getElementById('sheet-ability-select');
    if (!select) return;

    const char = (isNewChar === true || isNewChar === 'true') ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.specialAbilities) char.specialAbilities = [];

    let html = ['<option value="">-- Escolha uma Habilidade --</option>'];
    for (let k in window.DND3_SpecialAbilities) {
      const ability = window.DND3_SpecialAbilities[k];
      const isAlreadyAdded = char.specialAbilities.includes(k);
      const matchesQuery = ability.name.toLowerCase().includes(q) || ability.benefit.toLowerCase().includes(q) || ability.description.toLowerCase().includes(q);

      if (matchesQuery) {
        html.push(`<option value="${k}" ${isAlreadyAdded ? 'disabled' : ''}>${ability.name} ${isAlreadyAdded ? '(Já Adicionado)' : ''}</option>`);
      }
    }
    select.innerHTML = html.join('');
  }

  addAbilityFromSheet(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const select = container.querySelector('#sheet-ability-select');
    if (!select) return;

    const abilityKey = select.value;
    if (!abilityKey) {
      alert("Por favor, selecione uma habilidade válida da lista.");
      return;
    }

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.specialAbilities) char.specialAbilities = [];

    if (char.specialAbilities.includes(abilityKey)) {
      alert("Esta habilidade já foi adicionada.");
      return;
    }

    char.specialAbilities.push(abilityKey);

    if (isNew) {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    } else {
      this.saveCharactersState();
      this.renderOfficialSheet(char, container, false);
    }

    this.showToast(`Habilidade "${window.DND3_SpecialAbilities[abilityKey].name}" adicionada!`);
  }

  removeAbilityFromSheet(charId, abilityKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (!container) return;

    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    if (!char.specialAbilities) char.specialAbilities = [];

    char.specialAbilities = char.specialAbilities.filter(a => a !== abilityKey);

    if (isNew) {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
      this.renderNewCharacterSheet();
    } else {
      this.saveCharactersState();
      this.renderOfficialSheet(char, container, false);
    }

    this.showToast(`Habilidade removida.`);
  }

  renderCharacterSheetDetails(char, container) {
    this.renderOfficialSheet(char, container, false);
  }

  deleteCharacter(id, event) {
    if (event) event.stopPropagation();
    const char = this.savedCharacters.find(c => c.id === id);
    if (!char) return;

    if (this.currentUser && this.normalizeRole(this.currentUser.role) === 'player' && this.normalizeRole(char.owner) !== this.normalizeRole(this.currentUser.username)) {
      this.showCustomAlert("Você não tem permissão para deletar este personagem.");
      return;
    }

    this.showCustomConfirm(`Tem certeza que deseja apagar permanentemente o herói <strong>${char.name}</strong>?`, () => {
      this.savedCharacters = this.savedCharacters.filter(c => c.id !== id);
      this.saveCharactersState(id);
      
      this.logAction(`Excluiu o personagem: ${char.name}`);

      if (this.activeSheetId === id) {
        document.getElementById('sheet-detail-view').style.display = 'none';
        document.getElementById('sheets-list-view').style.display = 'block';
      }

      this.renderSavedSheetsList();
      this.showToast(`Personagem ${char.name} deletado com sucesso.`);
    });
  }

  // TAB 2: SHEETS LIST
  renderSavedSheetsList() {
    const container = document.getElementById('saved-sheets-container');
    if (!container) return;

    // Filter sheets based on current user role
    let visibleCharacters = this.savedCharacters;
    if (this.currentUser && this.normalizeRole(this.currentUser.role) === 'player') {
      const currentOwner = this.normalizeRole(this.currentUser.username);
      visibleCharacters = this.savedCharacters.filter(c => this.normalizeRole(c.owner) === currentOwner);
    }

    if (visibleCharacters.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <p>Nenhuma ficha de personagem salva.</p>
          <p style="font-size:0.85rem; margin-top:10px;">Use a aba "Criador de Personagem" para forjar seu primeiro herói!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="grid-3">` + visibleCharacters.map(char => {
      const stats = this.calculateDerivedStats(char); // update mods live
      const rc = window.DND3_Races[char.race];
      const cl = window.DND3_Classes[char.class];
      const ownerLabel = this.currentUser && this.normalizeRole(this.currentUser.role) === 'dm'
        ? `<div style="font-size:0.75rem; color:var(--accent-gold); margin-top:3px;"><strong>Dono:</strong> ${char.owner || 'mestre'}</div>`
        : '';
      return `
        <div class="rpg-card" style="cursor:pointer;" onclick="app.viewCharacterSheet('${char.id}')">
          <div class="card-title-container" style="margin-bottom:8px;">
            <h3 style="font-size:1.15rem; margin-right: 25px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${char.name}</h3>
            <button class="tracker-remove" onclick="app.deleteCharacter('${char.id}', event)" title="Excluir">🗑️</button>
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <!-- Miniature Avatar -->
            <div style="width:60px; height:70px; border-radius:4px; border:1px solid rgba(170,124,17,0.4); background:rgba(0,0,0,0.05); overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center;">
              ${char.avatar ? `<img src="${char.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size:1.8rem; color:rgba(170,124,17,0.4);">👤</span>`}
            </div>
            <!-- Details -->
            <div style="font-size:0.82rem; display:flex; flex-direction:column; gap:2px; flex:1; min-width:0;">
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><strong>Classe:</strong> ${cl.name} ${char.level || 1}</div>
              <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><strong>Raça:</strong> ${rc.name} (${rc.size})</div>
              <div><strong>HP:</strong> ${char.currentHp} / ${stats.maxHp}</div>
              <div><strong>CA:</strong> ${stats.ac} | BBA: +${stats.bab}</div>
              ${ownerLabel}
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;" onclick="event.stopPropagation()">
            <button class="rpg-btn rpg-btn-secondary" style="font-size:0.72rem; padding:4px 10px; border-color:var(--accent-gold); color:var(--accent-gold); flex:1; min-width:80px;" onclick="app.viewCharacterSheet('${char.id}')">
              📜 Ver Ficha
            </button>
            <button class="rpg-btn rpg-btn-secondary" style="font-size:0.72rem; padding:4px 10px; background:rgba(37,99,235,0.12); border-color:#2563eb; color:#60a5fa; flex:1; min-width:80px;" onclick="app.exportCharacterToExcel('${char.id}')">
              📤 Exportar .xlsx
            </button>
          </div>
        </div>
      `;
    }).join('') + `</div>`;
  }

  // VIEW SINGLE CHARACTER SHEET
  viewCharacterSheet(id) {
    const char = this.savedCharacters.find(c => c.id === id);
    if (!char) return;

    // Security check: players can only view their own characters
    if (this.currentUser && this.normalizeRole(this.currentUser.role) === 'player' && this.normalizeRole(char.owner) !== this.normalizeRole(this.currentUser.username)) {
      alert("Você não tem permissão para visualizar este personagem.");
      return;
    }

    this.activeSheetId = id;

    // Hide list, show sheet detail
    document.getElementById('sheets-list-view').style.display = 'none';
    const detailView = document.getElementById('sheet-detail-view');
    detailView.style.display = 'block';

    this.renderCharacterSheetDetails(char, detailView);
  }

  closeCharacterSheet() {
    this.activeSheetId = null;
    document.getElementById('sheet-detail-view').style.display = 'none';
    document.getElementById('sheets-list-view').style.display = 'block';
    this.renderSavedSheetsList();
  }

  calculateActiveStats(char) {
    let stats = this.calculateDerivedStats(char);
    
    // Apply temporary buffs to final values
    if (char.tempBuffs && char.tempBuffs.length > 0) {
      char.tempBuffs.forEach(buff => {
        if (buff.type === 'stat') {
          // Adjust base ability scores for the calculations
          const attr = buff.stat;
          const amt = buff.amount;
          stats.abilities[attr] += amt;
          // Recalculate that attribute's modifier
          stats.mods[attr] = Math.floor((stats.abilities[attr] - 10) / 2);
        }
      });

      // Recalculate derived stats with adjusted attributes
      const strMod = stats.mods.str;
      const dexMod = stats.mods.dex;
      const conMod = stats.mods.con;
      const wisMod = stats.mods.wis;

      // Re-apply dex limits to AC
      let maxDex = 99;
      if (char.equippedArmor) {
        maxDex = char.equippedArmor.maxDex !== undefined ? char.equippedArmor.maxDex : 99;
      } else if (char.armorMaxDex !== undefined && char.armorMaxDex !== null && char.armorMaxDex !== "") {
        const parsed = parseInt(char.armorMaxDex);
        if (!isNaN(parsed)) {
          maxDex = parsed;
        }
      }
      const appliedDex = Math.min(dexMod, maxDex);

      const sizeMap = {
        'Fine': 8,
        'Diminutive': 4,
        'Tiny': 2,
        'Small': 1,
        'Medium': 0,
        'Large': -1,
        'Huge': -2,
        'Gargantuan': -4,
        'Colossal': -8
      };
      const sizeMod = sizeMap[char.size] !== undefined ? sizeMap[char.size] : 0;

      let armorBonus = char.equippedArmor ? (char.equippedArmor.acBonus || 0) : (parseInt(char.acArmor) || 0);
      let shieldBonus = char.equippedShield ? (char.equippedShield.acBonus || 0) : (parseInt(char.acShield) || 0);
      const acNaturalVal = parseInt(char.acNatural) || 0;
      const acDeflectionVal = parseInt(char.acDeflection) || 0;
      const acMiscVal = parseInt(char.acMisc) || 0;

      stats.ac = 10 + armorBonus + shieldBonus + appliedDex + sizeMod + acNaturalVal + acDeflectionVal + acMiscVal;
      stats.flatFooted = 10 + armorBonus + shieldBonus + sizeMod + acNaturalVal + acDeflectionVal + acMiscVal;
      stats.touch = 10 + appliedDex + sizeMod + acDeflectionVal + acMiscVal;

      // Monk AC wisdom bonus update
      if (char.class === 'monk' && !char.equippedArmor && !char.equippedShield) {
        const monkWisBonus = Math.max(0, wisMod);
        stats.ac += monkWisBonus;
        stats.flatFooted += monkWisBonus;
        stats.touch += monkWisBonus;
      }

      // Initiative update
      const initMiscTotal = (char.initiativeMods || []).reduce((acc, curr) => acc + (parseInt(curr.val) || 0), 0);
      stats.initiative = dexMod + initMiscTotal;

      // Saves updates
      const fortMagicVal = parseInt(char.saveFortMagic) || 0;
      const fortMiscVal = parseInt(char.saveFortMisc) || 0;
      const fortTempVal = parseInt(char.saveFortTemp) || 0;
      const refMagicVal = parseInt(char.saveRefMagic) || 0;
      const refMiscVal = parseInt(char.saveRefMisc) || 0;
      const refTempVal = parseInt(char.saveRefTemp) || 0;
      const willMagicVal = parseInt(char.saveWillMagic) || 0;
      const willMiscVal = parseInt(char.saveWillMisc) || 0;
      const willTempVal = parseInt(char.saveWillTemp) || 0;
      const racialSaveBonus = char.race === 'halfling' ? 1 : 0;

      stats.fort = stats.fortBase + conMod + fortMagicVal + fortMiscVal + fortTempVal + racialSaveBonus;
      stats.ref = stats.refBase + dexMod + refMagicVal + refMiscVal + refTempVal + racialSaveBonus;
      stats.will = stats.willBase + wisMod + willMagicVal + willMiscVal + willTempVal + racialSaveBonus;

      // Combat updates
      stats.melee = stats.bab + strMod + sizeMod;
      stats.ranged = stats.bab + dexMod + sizeMod;
    }

    return stats;
  }

  sheetAdjustHp(charId, amt) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const stats = this.calculateActiveStats(char);
    let nextHp = char.currentHp + amt;
    if (nextHp > stats.maxHp) nextHp = stats.maxHp;
    if (nextHp < -10) nextHp = -10; // character dies at -10 in 3.0

    char.currentHp = nextHp;
    this.saveCharactersState();
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  sheetEquipItem(charId, itemId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const itemRecord = char.inventory.find(i => i.id === itemId);
    if (!itemRecord) return;

    if (itemRecord.category === 'weapons') {
      char.equippedWeapon = itemRecord.data;
    } else if (itemRecord.category === 'armor') {
      char.equippedArmor = itemRecord.data;
    } else if (itemRecord.category === 'shields') {
      char.equippedShield = itemRecord.data;
    }

    this.saveCharactersState();
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  recalculateArmorParts(char) {
    if (!char.equippedArmorParts) char.equippedArmorParts = [];

    let totalAcArmor = 0;
    let totalAcShield = 0;
    let minMaxDex = 99;
    let totalArmorCheckPenalty = 0;
    let totalShieldCheckPenalty = 0;

    char.equippedArmorParts.forEach(p => {
      if (p.partType === 'Escudo') {
        totalAcShield += parseInt(p.acBonus) || 0;
        totalShieldCheckPenalty += parseInt(p.penalty) || 0;
      } else {
        totalAcArmor += parseInt(p.acBonus) || 0;
        totalArmorCheckPenalty += parseInt(p.penalty) || 0;
        if (p.maxDex !== undefined && p.maxDex !== null && p.maxDex !== "") {
          minMaxDex = Math.min(minMaxDex, parseInt(p.maxDex));
        }
      }
    });

    char.acArmor = totalAcArmor;
    char.acShield = totalAcShield;
    char.armorMaxDex = minMaxDex === 99 ? "" : minMaxDex;
    char.armorCheckPenalty = totalArmorCheckPenalty === 0 ? "" : totalArmorCheckPenalty;
    char.shieldCheckPenalty = totalShieldCheckPenalty === 0 ? "" : totalShieldCheckPenalty;
  }

  clearManualArmor(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const oldName = char.armorName;
    char.armorName = "";
    char.acArmor = 0;
    char.armorMaxDex = "";
    char.armorDexPenalty = "";

    this.showToast(`Armadura desequipada: ${oldName}`);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  clearManualShield(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const oldName = char.shieldName;
    char.shieldName = "";
    char.acShield = 0;
    char.shieldDexPenalty = "";

    this.showToast(`Escudo desequipado: ${oldName}`);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  addManualArmorToInventory(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const armorName = char.armorName || "";
    if (!armorName) {
      this.showCustomAlert("Por favor, digite o nome da armadura.");
      return;
    }

    const bonus = parseInt(char.acArmor) || 0;
    const maxDex = char.armorMaxDex !== undefined ? char.armorMaxDex : "";
    const dexPenalty = char.armorDexPenalty !== undefined ? char.armorDexPenalty : "";
    
    let details = [];
    if (bonus) details.push(`+${bonus} CA`);
    if (maxDex !== "") details.push(`Des. Máx ${maxDex}`);
    if (dexPenalty !== "") details.push(`Redução DES -${dexPenalty}`);
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';

    const entry = `${armorName}${detailsStr}`;
    
    if (!char.inventoryText) char.inventoryText = "";
    if (char.inventoryText.trim() === "") {
      char.inventoryText = entry;
    } else {
      char.inventoryText += `\n${entry}`;
    }

    this.showToast(`Armadura adicionada ao equipamento: ${armorName}`);
    
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  addManualShieldToInventory(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const shieldName = char.shieldName || "";
    if (!shieldName) {
      this.showCustomAlert("Por favor, digite o nome do escudo.");
      return;
    }

    const bonus = parseInt(char.acShield) || 0;
    const shieldDexPenalty = char.shieldDexPenalty !== undefined ? char.shieldDexPenalty : "";
    
    let details = [];
    if (bonus) details.push(`+${bonus} CA`);
    if (shieldDexPenalty !== "") details.push(`Redução DES -${shieldDexPenalty}`);
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';

    const entry = `${shieldName}${detailsStr}`;
    
    if (!char.inventoryText) char.inventoryText = "";
    if (char.inventoryText.trim() === "") {
      char.inventoryText = entry;
    } else {
      char.inventoryText += `\n${entry}`;
    }

    this.showToast(`Escudo adicionado ao equipamento: ${shieldName}`);
    
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  addArmorPart(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const select = document.getElementById('sheet-armor-part-select');
    if (!select) return;

    const partKey = select.value;
    if (!partKey) {
      this.showCustomAlert("Por favor, selecione uma peça de armadura.");
      return;
    }

    const template = window.DND3_ModularArmorParts[partKey];
    if (!template) return;

    if (template.partType === 'Arma') {
      if (!char.weapons) char.weapons = [];
      char.weapons.push({
        name: template.name,
        attack: template.attack || '',
        damageBase: template.damageBase || '',
        damageMod: template.damageMod || '',
        critical: template.critical || '',
        range: template.range || 'Corpo-a-corpo',
        type: template.type || 'Cortante',
        notes: template.desc || ''
      });
      this.showToast(`Arma adicionada: ${template.name}`);
    } else {
      if (!char.equippedArmorParts) char.equippedArmorParts = [];
      const newPart = JSON.parse(JSON.stringify(template));
      newPart.key = partKey;
      char.equippedArmorParts.push(newPart);
      this.recalculateArmorParts(char);
      this.showToast(`Peça equipada: ${newPart.name}`);
    }

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  removeArmorPart(charId, index, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.equippedArmorParts || !char.equippedArmorParts[index]) return;

    const removed = char.equippedArmorParts[index];
    char.equippedArmorParts.splice(index, 1);

    this.recalculateArmorParts(char);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
    this.showToast(`Peça removida: ${removed.name}`);
  }

  sheetUseSpellSlot(charId, level, delta) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (char.spellSlotsSpent === undefined) char.spellSlotsSpent = {};
    if (char.spellSlotsSpent[level] === undefined) char.spellSlotsSpent[level] = 0;

    char.spellSlotsSpent[level] += delta;
    if (char.spellSlotsSpent[level] < 0) char.spellSlotsSpent[level] = 0;

    this.saveCharactersState();
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  sheetUseSpellSlotInteractive(charId, level, delta, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.spellSlotsSpent) char.spellSlotsSpent = {};
    if (char.spellSlotsSpent[level] === undefined) char.spellSlotsSpent[level] = 0;

    char.spellSlotsSpent[level] += delta;
    if (char.spellSlotsSpent[level] < 0) char.spellSlotsSpent[level] = 0;

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  addSpellToSheet(charId, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const select = document.getElementById('sheet-spell-select');
    if (!select) return;

    const spellKey = select.value;
    if (!spellKey) {
      this.showCustomAlert("Por favor, selecione uma magia.");
      return;
    }

    if (!char.spellsKnown) char.spellsKnown = [];

    if (char.spellsKnown.includes(spellKey)) {
      this.showCustomAlert("Esta magia já está no seu grimório.");
      return;
    }

    char.spellsKnown.push(spellKey);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
    
    const spell = window.DND3_SpellDatabase[spellKey];
    this.showToast(`Magia adicionada: ${spell ? spell.name : spellKey}`);
  }

  getCharSpellsPerDay(char) {
    const spellsPerDay = {};
    if (!char.classes || char.classes.length === 0) return spellsPerDay;

    // Determine prestige spellcaster advancement
    const prestigeCasterBonus = { divine: 0, arcane: 0, any: 0 };
    char.classes.forEach(c => {
      if (c.classKey === 'vingador_goriaque' || c.classKey === 'sacerdote_errante') {
        prestigeCasterBonus.divine += (parseInt(c.level) || 0);
      } else if (c.classKey === 'mage_of_the_arcane_order') {
        prestigeCasterBonus.arcane += (parseInt(c.level) || 0);
      } else if (c.classKey === 'loremaster') {
        prestigeCasterBonus.any += (parseInt(c.level) || 0);
      }
    });

    let isSpellcaster = false;

    char.classes.forEach(cls => {
      const classKey = cls.classKey;
      const classLevel = parseInt(cls.level) || 0;

      let extraLevels = 0;
      if (['cleric', 'druid', 'paladin', 'ranger'].includes(classKey)) {
        extraLevels += prestigeCasterBonus.divine + prestigeCasterBonus.any;
      } else if (['wizard', 'sorcerer', 'bard'].includes(classKey)) {
        extraLevels += prestigeCasterBonus.arcane + prestigeCasterBonus.any;
      }

      const effectiveClassLevel = classLevel + extraLevels;
      const baseProgress = window.DND3_Spells.getSlots(classKey, effectiveClassLevel);
      if (baseProgress && baseProgress.length > 0) {
        isSpellcaster = true;
        let castAttr = 'wis';
        if (classKey === 'wizard') castAttr = 'int';
        if (classKey === 'sorcerer' || classKey === 'bard') castAttr = 'cha';

        const rc = window.DND3_Races[char.race] || { modifiers: {} };
        const baseObj = char.abilitiesBase || {};
        const getActiveAttr = (attr) => {
          const base = parseInt(baseObj[attr]) || 10;
          const raceMod = parseInt(rc.modifiers[attr]) || 0;
          const lvlUpMod = parseInt(char.levelUpAttributes?.[attr]) || 0;
          const offsetVal = char.abilitiesTemp?.[attr];
          const offset = (offsetVal !== undefined && offsetVal !== null && offsetVal !== "" && !isNaN(parseInt(offsetVal))) ? parseInt(offsetVal) : 0;
          
          let armorPartMod = 0;
          if (char.equippedArmorParts && char.equippedArmorParts.length > 0) {
            char.equippedArmorParts.forEach(p => {
              if (p.attrMods && p.attrMods[attr] !== undefined) {
                armorPartMod += parseInt(p.attrMods[attr]) || 0;
              }
            });
          }
          return base + raceMod + lvlUpMod + offset + armorPartMod;
        };

        const abilityScore = getActiveAttr(castAttr);
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        baseProgress.forEach((baseVal, lvl) => {
          if (baseVal === undefined) return;
          
          const domainBonus = (classKey === 'cleric' && lvl > 0) ? 1 : 0;
          const bonusVal = (lvl > 0 && abilityScore >= 10 + lvl) ? window.DND3_Spells.getBonusSpells(abilityMod, lvl) : 0;
          const total = baseVal + bonusVal + domainBonus;

          if (!spellsPerDay[lvl]) {
            spellsPerDay[lvl] = { total: 0, base: 0, bonus: 0 };
          }
          spellsPerDay[lvl].total += total;
          spellsPerDay[lvl].base += baseVal;
          spellsPerDay[lvl].bonus += bonusVal + domainBonus;
        });

        // Epic Spellcasting (Level 10 Slots)
        if (char.feats && char.feats.includes('epic_spellcasting')) {
          const spellcraftRank = parseInt(char.skills?.spellcraft) || 0;
          const epicSlots = Math.max(1, Math.floor(spellcraftRank / 10));
          
          spellsPerDay[10] = {
            total: epicSlots,
            base: epicSlots,
            bonus: 0
          };
        }
      }
    });

    // Fallback for prestige-only casting
    if (!isSpellcaster && (prestigeCasterBonus.divine > 0 || prestigeCasterBonus.arcane > 0)) {
      const fallbackClass = prestigeCasterBonus.divine > 0 ? 'cleric' : 'wizard';
      const fallbackLvl = prestigeCasterBonus.divine > 0 ? prestigeCasterBonus.divine : prestigeCasterBonus.arcane;
      const baseProgress = window.DND3_Spells.getSlots(fallbackClass, fallbackLvl);
      if (baseProgress && baseProgress.length > 0) {
        let castAttr = fallbackClass === 'wizard' ? 'int' : 'wis';
        const rc = window.DND3_Races[char.race] || { modifiers: {} };
        const baseObj = char.abilitiesBase || {};
        const abilityScore = (parseInt(baseObj[castAttr]) || 10) + (parseInt(rc.modifiers[castAttr]) || 0);
        const abilityMod = Math.floor((abilityScore - 10) / 2);

        baseProgress.forEach((baseVal, lvl) => {
          if (baseVal === undefined) return;
          const domainBonus = (fallbackClass === 'cleric' && lvl > 0) ? 1 : 0;
          const bonusVal = (lvl > 0 && abilityScore >= 10 + lvl) ? window.DND3_Spells.getBonusSpells(abilityMod, lvl) : 0;
          const total = baseVal + bonusVal + domainBonus;
          if (!spellsPerDay[lvl]) spellsPerDay[lvl] = { total: 0, base: 0, bonus: 0 };
          spellsPerDay[lvl].total += total;
          spellsPerDay[lvl].base += baseVal;
          spellsPerDay[lvl].bonus += bonusVal + domainBonus;
        });
      }
    }

    return spellsPerDay;
  }

  filterSheetSpellOptions() {
    const searchInput = document.getElementById('sheet-spell-search-input');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    const select = document.getElementById('sheet-spell-select');
    if (!select) return;

    const isNew = document.getElementById('official-sheet-creator-container') && 
                  document.getElementById('official-sheet-creator-container').style.display !== 'none';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === this.activeSheetId);
    if (!char) return;

    const castingClasses = char.classes ? char.classes.map(c => {
      if (c.classKey === 'sacerdote_errante' || c.classKey === 'vingador_goriaque') return 'cleric';
      if (c.classKey === 'mage_of_the_arcane_order') return 'wizard';
      return c.classKey;
    }).filter(k => ['wizard', 'cleric', 'druid', 'bard', 'sorcerer', 'paladin', 'ranger'].includes(k)) : [];
    const spellsPerDay = this.getCharSpellsPerDay(char);
    
    const availableSpells = Object.keys(window.DND3_SpellDatabase).filter(k => {
      const spell = window.DND3_SpellDatabase[k];
      const matchesClass = spell.classes.some(c => castingClasses.includes(c));
      const matchesLevel = spellsPerDay[spell.level] !== undefined && spellsPerDay[spell.level].total > 0;
      const matchesSearch = spell.name.toLowerCase().includes(searchVal) || 
                            (spell.desc && spell.desc.toLowerCase().includes(searchVal));
      return matchesClass && matchesLevel && matchesSearch;
    });

    let html = '<option value="">-- Adicionar Magia da Classe --</option>';
    availableSpells.forEach(k => {
      const sp = window.DND3_SpellDatabase[k];
      html += `<option value="${k}">[Nível ${sp.level}] ${sp.name}</option>`;
    });
    select.innerHTML = html;
  }

  removeSpellFromSheet(charId, spellKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const activeChar = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!activeChar) return;

    if (!activeChar.spellsKnown) return;

    activeChar.spellsKnown = activeChar.spellsKnown.filter(k => k !== spellKey);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }

    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(activeChar, container, isNew);
    }
    const spell = window.DND3_SpellDatabase[spellKey];
    this.showToast(`Magia removida: ${spell ? spell.name : spellKey}`);
  }

  lookupSpellDetails(spellKey) {
    const resultEl = document.getElementById('sheet-spell-lookup-result');
    if (!resultEl) return;

    if (!spellKey) {
      resultEl.style.display = 'none';
      resultEl.innerHTML = '';
      return;
    }

    const sp = window.DND3_SpellDatabase[spellKey];
    if (!sp) {
      resultEl.style.display = 'none';
      return;
    }

    const classesText = sp.classes.map(c => window.DND3_Classes[c] ? window.DND3_Classes[c].name : c).join(', ');

    resultEl.innerHTML = `
      <div style="font-weight: bold; color: var(--accent-gold); margin-bottom: 4px; font-size: 0.8rem; font-family:var(--font-header);">
        ${sp.name}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; font-size: 0.7rem; color: var(--text-muted); text-align: left;">
        <div><strong>Escola:</strong> ${sp.school}</div>
        <div><strong>Nível:</strong> ${sp.level} (${classesText})</div>
        <div><strong>Alcance:</strong> ${sp.range}</div>
        <div><strong>Duração:</strong> ${sp.duration}</div>
        <div><strong>Resistência:</strong> ${sp.save}</div>
        <div><strong>RM:</strong> ${sp.spellRes}</div>
        <div><strong>Efeito/Dano:</strong> <span style="color:var(--accent-gold);">${sp.damage}</span></div>
        <div style="grid-column: 1 / -1; margin-top: 4px; font-style: italic; color: var(--text-parchment);">${sp.desc}</div>
        <div style="grid-column: 1 / -1; color: #ff9999; font-size: 0.65rem; margin-top: 2px;"><strong>Como Executar:</strong> ${sp.check}</div>
      </div>
    `;
    resultEl.style.display = 'block';
  }

  // BUFFS HANDLERS
  sheetAddBuffModal(charId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family:var(--font-header);">Adicionar Encantamento / Buff</h3>
      <div class="rpg-form-group">
        <label class="rpg-label">Selecione a Magia de Buff</label>
        <select id="buff-select-spell" class="rpg-select" onchange="app.updateBuffModalExplain(this.value)">
          <option value="bulls_strength">Força do Touro (Bull's Strength) - +1d4+1 FOR</option>
          <option value="cats_grace">Graça do Gato (Cat's Grace) - +1d4+1 DES</option>
          <option value="endurance">Resistência Física (Endurance) - +1d4+1 CON</option>
          <option value="mage_armor">Armadura Arcana (Mage Armor) - +4 CA (Aumento Fixo)</option>
          <option value="shield">Escudo Arcano (Shield) - +7 CA (Aumento Fixo)</option>
        </select>
      </div>

      <div id="buff-explain" style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem; background:rgba(0,0,0,0.2); padding:10px; border-radius:4px; border-left:3px solid var(--accent-gold);">
        O bônus desta magia de aumento físico de atributo será determinado rolando um dado 1d4 + 1.
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button class="rpg-btn" onclick="app.sheetApplyBuff('${charId}')">Aplicar Buff</button>
      </div>
    `;

    this.showModal();
  }

  updateBuffModalExplain(val) {
    const explain = document.getElementById('buff-explain');
    if (val === 'bulls_strength' || val === 'cats_grace' || val === 'endurance') {
      explain.innerHTML = `O bônus deste buff de atributo físico será determinado rolando <strong>1d4+1</strong> (diferente do bônus fixo +4 em outras versões).`;
    } else if (val === 'mage_armor') {
      explain.innerHTML = `Adiciona uma força mágica que fornece +4 de bônus na CA. Não acumula com outras armaduras normais.`;
    } else if (val === 'shield') {
      explain.innerHTML = `Cria um escudo invisível fornecendo <strong>+7 de cobertura na CA</strong> e bloqueando Mísseis Mágicos totalmente.`;
    }
  }

  sheetApplyBuff(charId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const select = document.getElementById('buff-select-spell');
    const buffVal = select.value;

    let buffName = "";
    let buffType = "stat"; // or ac
    let stat = "";
    let amount = 0;
    let desc = "";

    if (buffVal === 'bulls_strength') {
      buffName = "Força do Touro";
      stat = "str";
      let roll = Math.floor(Math.random() * 4) + 1;
      amount = roll + 1;
      desc = `+${amount} FOR (Rolagem: 1d4:${roll}+1)`;
    } else if (buffVal === 'cats_grace') {
      buffName = "Graça do Gato";
      stat = "dex";
      let roll = Math.floor(Math.random() * 4) + 1;
      amount = roll + 1;
      desc = `+${amount} DES (Rolagem: 1d4:${roll}+1)`;
    } else if (buffVal === 'endurance') {
      buffName = "Resistência Física (Endurance)";
      stat = "con";
      let roll = Math.floor(Math.random() * 4) + 1;
      amount = roll + 1;
      desc = `+${amount} CON (Rolagem: 1d4:${roll}+1)`;
    } else if (buffVal === 'mage_armor') {
      // Create it as general buff (adds AC in active calculation)
      buffName = "Armadura Arcana";
      buffType = "ac";
      amount = 4;
      desc = `+4 CA fixo`;
    } else if (buffVal === 'shield') {
      buffName = "Escudo Arcano";
      buffType = "ac";
      amount = 7;
      desc = `+7 CA (cobertura)`;
    }

    if (!char.tempBuffs) char.tempBuffs = [];
    char.tempBuffs.push({
      key: buffVal,
      name: buffName,
      type: buffType,
      stat: stat,
      amount: amount,
      desc: desc
    });

    this.saveCharactersState();
    this.closeModal();
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  sheetRemoveBuff(charId, idx) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    char.tempBuffs.splice(idx, 1);
    this.saveCharactersState();
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  getCombatantDisplayName(c) {
    if (!c) return "";
    if (c.type === 'player') return c.name;
    const levelVal = c.level || c.baseHD || 1;
    const levelStr = ` (Nível ${levelVal})`;
    const sameNameMonsters = this.dmCombatants.filter(x => x.type === 'npc' && x.name === c.name);
    if (sameNameMonsters.length > 1) {
      const index = sameNameMonsters.indexOf(c);
      return `${c.name} ${index + 1}${levelStr}`;
    }
    return `${c.name}${levelStr}`;
  }

  // TAB 3: DUNGEON MASTER TOOLS
  renderDMCombatTracker() {
    const listEl = document.getElementById('dm-combat-list');
    const monstersListEl = document.getElementById('dm-scene-monsters-list');
    if (!listEl) return;

    // Populate quick add player select dropdown
    const quickSelect = document.getElementById('dm-quick-select-player');
    if (quickSelect) {
      quickSelect.innerHTML = '<option value="">-- Adicionar Jogador --</option>' + 
        this.savedCharacters.map(p => {
          const alreadyIn = this.dmCombatants.some(c => c.charId === p.id);
          return `<option value="${p.id}" ${alreadyIn ? 'disabled' : ''}>${p.name} (Lvl ${p.level || 1} ${window.DND3_Classes[p.class].name}) ${alreadyIn ? '[Em Combate]' : ''}</option>`;
        }).join('');
    }

    // Populate the bestiary dropdown on the scene side if empty/not initialized
    const sceneMonsterSelect = document.getElementById('dm-scene-monster-select');
    if (sceneMonsterSelect && sceneMonsterSelect.children.length <= 1) {
      this.dmSceneFilterMonsters(''); // populate initially
    }

    // Populate the custom monsters dropdown on the scene side if empty/not initialized
    const customMonsterSelect = document.getElementById('dm-scene-monster-custom-select');
    if (customMonsterSelect && customMonsterSelect.children.length <= 1) {
      this.dmSceneFilterCustomMonsters(''); // populate custom initially
    }

    // Identify active combatant
    const activeCombatant = this.dmCombatants ? this.dmCombatants[this.dmTurnIndex] : null;

    // Filter players and monsters
    const playersList = [];
    const monstersList = [];

    if (this.dmCombatants && this.dmCombatants.length > 0) {
      this.dmCombatants.forEach((c, idx) => {
        const info = { ...c, originalIndex: idx };
        if (c.type === 'player') {
          playersList.push(info);
        } else {
          monstersList.push(info);
        }
      });
    }

    // RENDER PLAYERS (Aventureiros)
    let playersHtml = "";
    if (playersList.length === 0) {
      playersHtml = `<div style="text-align:center; padding: 2rem; color:var(--text-muted); font-size:0.85rem;">Nenhum aventureiro em combate.</div>`;
    } else {
      const cardsHtml = playersList.map(p => {
        const idx = p.originalIndex;
        const isActive = idx === this.dmTurnIndex;
        const isDefeated = p.currentHp <= 0;

        const deathClass = isDefeated ? ' card-defeated' : '';
        const skullOverlay = isDefeated ? '<div class="death-skull-overlay">💀</div>' : '';

        const borderStyle = isDefeated ? '' 
          : (isActive ? 'border: 2px solid var(--accent-gold); box-shadow: 0 0 12px rgba(234,179,8,0.5);' 
                      : 'border: 1px solid rgba(255,255,255,0.1);');

        // HP bar percentage
        const hpPct = p.maxHp > 0 ? Math.max(0, Math.round((p.currentHp / p.maxHp) * 100)) : 0;
        const hpColor = hpPct > 60 ? '#2ecc71' : hpPct > 30 ? '#f39c12' : '#e74c3c';
        const hpTextColor = isDefeated ? 'var(--accent-red)' : hpColor;

        // Action dots (com suporte a quebra de linha em flex-wrap)
        const maxSlots = p.actionsMax || this.getCombatantMaxActions(p) || 1;
        const usedSlotsArr = p.usedActionSlots || [];
        const actionDotsHtml = Array.from({ length: maxSlots }, (_, i) =>
          `<span style="font-size:0.62rem; line-height:1; flex-shrink:0;">${usedSlotsArr.includes(i) ? '🔴' : '🟢'}</span>`
        ).join('');

        const activeLabel = isActive
          ? '<div style="font-size:0.5rem; background:var(--accent-gold); color:#000; border-radius:2px; padding:0 2px; font-weight:bold; margin-top:1px; text-align:center; line-height:1;">ATIVO</div>'
          : '';

        return `
          <div class="character-battle-card${deathClass}" 
            style="position:relative; flex:1 1 calc(25% - 5px); max-width:82px; min-width:64px; padding:4px 3px 3px; border-radius:6px; ${borderStyle} background:${isDefeated ? 'rgba(80,0,0,0.35)' : (isActive ? 'rgba(234,179,8,0.08)' : 'rgba(0,0,0,0.3)')}; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:2px; text-align:center; transition:var(--transition-smooth); box-sizing:border-box;"
            title="${p.name}">
            ${skullOverlay}
            <button class="tracker-remove" onclick="app.dmRemoveCombatant(${idx})" style="position:absolute; top:1px; right:1px; background:none; border:none; cursor:pointer; font-size:0.62rem; z-index:15; padding:0;" title="Excluir da Batalha">🗑️</button>

            <!-- Nome e Nível -->
            <div style="width:100%; padding-right:8px; box-sizing:border-box;">
              <div style="font-weight:bold; font-size:0.72rem; color:${isActive ? 'var(--accent-gold)' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.1;">${p.name}</div>
              <div style="font-size:0.58rem; color:var(--text-muted); margin-top:1px; line-height:1;">Nível ${p.level || 1}</div>
              ${activeLabel}
            </div>

            <!-- HP (Capacidade de 4 dígitos) -->
            <div style="width:100%;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:1px;">
                <span style="font-size:0.55rem; color:var(--text-muted); font-weight:bold;">HP</span>
                <span style="font-size:0.7rem; font-weight:bold; color:${hpTextColor}; white-space:nowrap;">${p.currentHp}<span style="font-size:0.52rem; color:var(--text-muted);">/${p.maxHp}</span></span>
              </div>
              <div style="height:3px; border-radius:2px; background:rgba(255,255,255,0.08); overflow:hidden;">
                <div style="height:100%; width:${hpPct}%; background:${hpColor}; border-radius:2px; transition:width 0.4s ease;"></div>
              </div>
            </div>

            <!-- Ações (bolinhas com quebra automática de linha) -->
            <div style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:1px; width:100%; margin-top:1px;">
              ${actionDotsHtml}
            </div>
          </div>
        `;
      }).join('');
      playersHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 0;">${cardsHtml}</div>`;
    }
    listEl.innerHTML = playersHtml;

    // RENDER MONSTERS (Ameaças)
    let monstersHtml = "";
    if (monstersList.length === 0) {
      monstersHtml = `<div style="text-align:center; padding: 2rem; color:var(--text-muted); font-size:0.85rem;">Nenhum monstro em cena.</div>`;
    } else {
      monstersList.forEach(m => {
        const idx = m.originalIndex;
        const isActive = idx === this.dmTurnIndex;
        const isDown = m.currentHp <= 0;
        const activeStyle = isActive ? 'border: 2px solid #ff4444; box-shadow: 0 0 10px rgba(255,68,68,0.4);' : 'border: 1px solid rgba(255,68,68,0.2);';
        const bgStyle = isDown ? 'background: rgba(139,0,0,0.15); opacity:0.7;' : 'background: rgba(255,255,255,0.02);';
        
        const condsText = m.conditions && m.conditions.length > 0
          ? m.conditions.map(cd => `<span class="condition-tag">${cd}</span>`).join('')
          : '<em style="font-size:0.7rem; color:var(--text-muted);">Nenhuma</em>';

        const monsterBuffsText = (m.buffs && m.buffs.length > 0)
          ? m.buffs.map(b => `<span class="condition-tag" style="margin-right:2px; padding:1px 4px; font-size:0.65rem; background:rgba(2,132,199,0.25); border:1px solid rgba(56,189,248,0.4); color:#38bdf8;">${b}</span>`).join('')
          : '<em style="font-size:0.65rem; color:var(--text-muted);">Nenhum</em>';

        const dispName = this.getCombatantDisplayName(m);
        const damageByPlayer = m.damageByPlayer || {};
        const totalDamage = Object.values(damageByPlayer).reduce((a, b) => a + b, 0);
        const modifiedStats = this.getModifiedMonsterStats(m);
        const fortVal = modifiedStats.saves.fort;
        const refVal = modifiedStats.saves.ref;
        const willVal = modifiedStats.saves.will;
        const attrs = m.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const getMod = (val) => {
          const mod = Math.floor((val - 10) / 2);
          return mod >= 0 ? `+${mod}` : `${mod}`;
        };

        monstersHtml += `
          <div class="dm-monster-card" style="padding: 10px 12px; border-radius: 8px; ${activeStyle} ${bgStyle} display:flex; flex-direction:column; gap:6px; position:relative; box-shadow: 0 4px 6px rgba(0,0,0,0.15); font-size:0.8rem;">
            <!-- Linha 1: Avatar / Nome / Ações / Lixeira -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0; overflow:hidden;">
                ${(() => {
                  const imgUrl = m.avatar || this.getMonsterImageUrl(m.name);
                  const filterStyle = m.avatar ? '' : this.getMonsterImageFilter(m.name);
                  return `<img src="${imgUrl}" style="width:26px; height:26px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,68,68,0.25); flex-shrink:0; ${filterStyle}" alt="${dispName}">`;
                })()}
                <strong style="font-size:0.95rem; color:#ff4444; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; min-width:0;">${dispName}</strong>
              </div>
              <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                <button class="rpg-btn" style="padding:2px 6px; font-size:0.68rem; height:22px; line-height:1; background:linear-gradient(135deg, var(--accent-gold), #854d0e); border-color:var(--accent-gold); color:#111; font-weight:bold;" onclick="app.dmCombatantActionsModal(${idx})" title="Ações do Monstro">⚔️ Ações</button>
                <button class="tracker-remove" onclick="app.dmRemoveCombatant(${idx})" style="background:none; border:none; cursor:pointer; font-size:0.9rem; padding:2px 4px;" title="Remover da Batalha">🗑️</button>
              </div>
            </div>

            <!-- Linha 2: HP / CA / RM / Bolinhas da Ação -->
            <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.12); padding:4px 8px; border-radius:4px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:2px; background:rgba(139,0,0,0.25); padding:1px 4px; border-radius:4px; border:1px solid rgba(255,68,68,0.3); white-space:nowrap;">
                <span style="font-weight:bold; color:#ff6666; font-size:0.72rem;">HP:</span>
                <input type="number" value="${m.currentHp}" onchange="app.dmUpdateCombatantHp(${idx}, this.value)" style="width:44px; text-align:center; height:18px; font-size:0.72rem; padding:0 1px; background:rgba(0,0,0,0.3); border:1px solid #555; color:#fff; border-radius:3px;">
                <span style="color:#aaa; font-size:0.68rem;">/${modifiedStats.maxHp}</span>
              </div>
              <span style="font-size:0.72rem; color:#aaa; background:rgba(0,0,0,0.25); padding:2px 5px; border-radius:4px; border:1px solid rgba(255,68,68,0.2); white-space:nowrap;">CA ${modifiedStats.ac}</span>
              <span style="font-size:0.72rem; color:#aaa; background:rgba(0,0,0,0.25); padding:2px 5px; border-radius:4px; border:1px solid rgba(255,68,68,0.2); white-space:nowrap;">RM ${modifiedStats.rm || 0}</span>
              <span style="font-size:0.8rem; letter-spacing:0px; display:inline-flex; align-items:center; gap:2px; margin-left:2px;">
                ${(() => {
                  const max = m.actionsMax || this.getCombatantMaxActions(m) || 1;
                  const used = m.actionsUsed || 0;
                  let dots = '';
                  for (let i = 0; i < max; i++) {
                    dots += i < (max - used) ? '🟢' : '🔴';
                  }
                  return dots;
                })()}
              </span>
            </div>

            <!-- Linha 3: Cura / Init / Pular / Último -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; background:rgba(0,0,0,0.15); padding:4px 6px; border-radius:4px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:3px; flex-shrink:0;">
                <span style="font-size:0.68rem; font-weight:bold; color:#2ecc71; white-space:nowrap;">Cura:</span>
                <input type="number" id="dmg-heal-amt-${idx}" class="rpg-input" style="width:42px; padding:1px 2px; font-size:0.68rem; text-align:center; height:20px; background:rgba(0,0,0,0.3); border:1px solid #555; color:#fff; border-radius:3px;" placeholder="PV" max="9999">
                <button class="rpg-btn" style="padding:1px 5px; font-size:0.62rem; height:20px; line-height:1; background:linear-gradient(135deg, #10b981, #047857); border:none; text-transform:none;" onclick="app.dmApplyDmgHeal(${idx}, 1)">Heal</button>
              </div>

              <div style="display:flex; align-items:center; gap:2px; flex-shrink:0; flex-wrap:wrap;">
                <span style="font-size:0.68rem; font-weight:bold; color:#ff4444;">Init:</span>
                <input type="number" id="dm-init-val-${idx}" value="${m.initRoll !== undefined && m.initRoll !== null ? m.initRoll : ''}" onchange="app.dmSaveInitiative(${idx}, this.value)" placeholder="--" style="width:28px; text-align:center; height:20px; font-size:0.68rem; background:rgba(0,0,0,0.2); border:1px solid #555; color:#fff; border-radius:3px; padding:0;" max="99">
                <button class="rpg-btn" style="padding:0 3px; font-size:0.65rem; height:20px; line-height:1; background: linear-gradient(135deg, var(--accent-gold), #854d0e); border-color: var(--accent-gold);" onclick="app.dmRollInitiativeFor(${idx})" title="Rolar">🎲</button>
                <button class="rpg-btn rpg-btn-secondary" style="padding:1px 4px; font-size:0.62rem; height:20px; line-height:1; text-transform:none;" onclick="app.dmClearInitiative(${idx})" title="Zerar Iniciativa">Zerar</button>
                <button class="rpg-btn" style="padding:1px 5px; font-size:0.62rem; height:20px; line-height:1; background:linear-gradient(135deg, #374151, #1f2937); border-color:#6b7280; text-transform:none;" onclick="app.skipCombatantTurn(${idx})" title="Pular Turno">Pular</button>
                <button class="rpg-btn" style="padding:1px 5px; font-size:0.62rem; height:20px; line-height:1; background:linear-gradient(135deg, #475569, #334155); border-color:#94a3b8; text-transform:none;" onclick="app.actLastCombatant(${idx})" title="Agir por Último">Último</button>
              </div>
            </div>

            <!-- Linha 4: Resistências -->
            <div style="font-size: 0.72rem; color: #ccc; background: rgba(0,0,0,0.1); padding: 4px 8px; border-radius: 4px; display: flex; gap: 10px; justify-content: space-between;">
              <strong style="color: var(--accent-gold);">Resistências:</strong>
              <span>Fort: ${fortVal >= 0 ? '+' : ''}${fortVal}</span>
              <span>Ref: ${refVal >= 0 ? '+' : ''}${refVal}</span>
              <span>Von: ${willVal >= 0 ? '+' : ''}${willVal}</span>
            </div>

            <!-- Atributos do Monstro (3 Linhas) -->
            <div style="font-size: 0.72rem; background: rgba(0,0,0,0.15); padding: 4px 6px; border-radius: 4px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; text-align: center; border-top: 1px dashed rgba(255,68,68,0.15); border-bottom: 1px dashed rgba(255,68,68,0.15); line-height: 1.2;">
              <!-- Linha 1: Nome dos Atributos -->
              <div style="grid-column: span 6; display: grid; grid-template-columns: repeat(6, 1fr); font-weight: bold; color: var(--text-muted); font-size: 0.65rem;">
                <div>FOR</div>
                <div>DES</div>
                <div>CON</div>
                <div>INT</div>
                <div>SAB</div>
                <div>CAR</div>
              </div>
              <!-- Linha 2: Valor Bruto -->
              <div style="grid-column: span 6; display: grid; grid-template-columns: repeat(6, 1fr); font-weight: bold; color: #ff9999;">
                <div>${attrs.str}</div>
                <div>${attrs.dex}</div>
                <div>${attrs.con}</div>
                <div>${attrs.int}</div>
                <div>${attrs.wis}</div>
                <div>${attrs.cha}</div>
              </div>
              <!-- Linha 3: Modificadores -->
              <div style="grid-column: span 6; display: grid; grid-template-columns: repeat(6, 1fr); color: #ccc; font-size: 0.68rem;">
                <div>${getMod(attrs.str)}</div>
                <div>${getMod(attrs.dex)}</div>
                <div>${getMod(attrs.con)}</div>
                <div>${getMod(attrs.int)}</div>
                <div>${getMod(attrs.wis)}</div>
                <div>${getMod(attrs.cha)}</div>
              </div>
            </div>

            <!-- Linha 5: Buff -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(0,0,0,0.12); padding:4px 8px; border-radius:4px;">
              <div style="display:flex; align-items:center; gap:6px; overflow:hidden; flex:1;">
                <span style="font-size:0.75rem; font-weight:bold; color:#66ccff; white-space:nowrap;">Buff:</span>
                <div style="display:flex; align-items:center; gap:4px; overflow:hidden;">
                  ${monsterBuffsText}
                </div>
              </div>
              <button class="rpg-btn" style="padding:1px 6px; font-size:0.65rem; height:20px; line-height:1; background:linear-gradient(135deg, #0284c7, #0369a1); border:none; flex-shrink:0;" onclick="app.dmManageBuffsModal(${idx})">+ Buff</button>
            </div>

            <!-- Linha 7: Status -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; border-top:1px dashed rgba(255,68,68,0.1); padding-top:4px;">
              <div style="display:flex; align-items:center; gap:2px; flex-wrap:nowrap; overflow:hidden; flex:1;">
                <span style="font-size:0.68rem; font-weight:bold; color:#ff4444; white-space:nowrap; flex-shrink:0;">Status:</span>
                <div style="display:flex; align-items:center; gap:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
                  ${condsText}
                </div>
              </div>
              <button class="rpg-btn" style="padding:1px 5px; font-size:0.62rem; height:18px; line-height:1; background:#444; border:1px solid #666; flex-shrink:0;" onclick="app.dmManageConditionsModal(${idx})">Status</button>
            </div>

            <!-- Linha 8: Rolagem de danos (Dano Causado por Jogadores) -->
            <div style="font-size:0.75rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,68,68,0.25); border-radius:4px; padding:4px 8px; margin-top:2px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,68,68,0.15); padding-bottom:2px; margin-bottom:4px;">
                <span style="font-weight:bold; color:#ff6666; font-size:0.72rem;">📊 Dano Causado pelos Jogadores:</span>
                <span style="font-weight:bold; color:#ff4444; font-size:0.72rem;">Total: ${totalDamage} HP</span>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${Object.keys(damageByPlayer).length > 0 ? Object.entries(damageByPlayer).map(([attacker, dmg]) => `
                  <span style="background:rgba(255,68,68,0.15); border:1px solid rgba(255,68,68,0.3); padding:1px 5px; border-radius:3px; font-size:0.68rem; color:#ff9999; white-space:nowrap;">
                    <strong>${attacker}:</strong> ${dmg} HP
                  </span>
                `).join('') : '<em style="color:var(--text-muted); font-size:0.68rem;">Nenhum dano registrado ainda</em>'}
              </div>
            </div>
          </div>
        `;
      });
    }
    if (monstersListEl) {
      monstersListEl.innerHTML = monstersHtml;
    }

    // Render battle invitation response status for DM when active
    const inviteContainer = document.getElementById('dm-invite-control-container');
    if (inviteContainer) {
      if (!this.inviteActive) {
        inviteContainer.innerHTML = '';
      } else {
        const responsesHtml = Object.entries(this.playerResponses || {}).map(([usr, status]) => {
          let badge = '<span style="color:#eab308;">⏳ Pendente</span>';
          if (status === 'accepted') badge = '<span style="color:#2ecc71;">✅ Aceitou</span>';
          if (status === 'declined') badge = '<span style="color:#e74c3c;">❌ Recusou</span>';
          return `<div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.8rem;">
            <strong>${usr}</strong>
            ${badge}
          </div>`;
        }).join('') || '<div style="color:var(--text-muted); font-size:0.75rem; text-align:center;">Nenhum jogador na mesa.</div>';

        inviteContainer.innerHTML = `
          <div style="background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); padding: 12px; border-radius: 8px; display:flex; flex-direction:column; gap:8px;">
            <div style="font-family: var(--font-header); font-size: 0.85rem; color: var(--accent-gold); text-align:center; font-weight:bold;">Convite de Batalha Ativo</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${responsesHtml}
            </div>
            <button class="rpg-btn rpg-btn-secondary" style="width: 100%; padding: 4px; font-size: 0.75rem; border-color: var(--accent-red); color: var(--accent-red);" onclick="app.dmCancelBattleInvite()">
              Cancelar Convite
            </button>
          </div>
        `;
      }
    }
    const badge = document.getElementById('battlefield-mode-badge');
    if (badge) {
      badge.innerHTML = '<span style="color:var(--accent-red); font-weight:bold;">Painel do Mestre</span>';
    }
  }

  toggleAddMonsterForm() {
    const form = document.getElementById('dm-add-monster-form-container');
    if (!form) return;
    if (form.style.display === 'none' || form.style.display === '') {
      form.style.display = 'flex';
      this.playSound('click');
    } else {
      form.style.display = 'none';
      this.playSound('click');
    }
  }

  dmAddNPCModal() {
    this.dmNpcSelectedMonster = "";
    this.dmNpcProgressedHD = 1;
    
    const modalBody = document.getElementById('modal-body-content');
    
    // Build options list from saved characters to load as players
    let playerOptions = this.savedCharacters.map(p => `
      <option value="${p.id}">${p.name} (Lvl 1 ${window.DND3_Classes[p.class].name})</option>
    `).join('');

    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family:var(--font-header);">Adicionar Combatente</h3>
      
      <div style="border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:15px; margin-bottom:15px;">
        <h4 style="font-size:0.95rem; color:var(--accent-gold); margin-bottom:5px;">Carregar Ficha de Aventureiro</h4>
        <div style="display:flex; gap:10px; align-items:center;">
          <select id="dm-select-player" class="rpg-select" style="flex:1;">
            <option value="">-- Escolha um herói salvo --</option>
            ${playerOptions}
          </select>
          <button class="rpg-btn" onclick="app.dmAddPlayerToCombat()">Carregar Herói</button>
        </div>
      </div>

      <div>
        <h4 style="font-size:0.95rem; color:var(--accent-gold); margin-bottom:10px;">Adicionar Ameaça (Monstro)</h4>
        
        <!-- Toggle button between created and bestiary -->
        <div style="display:flex; gap:10px; margin-bottom:15px;">
          <button id="dm-npc-btn-created" class="rpg-btn rpg-btn-secondary" style="flex:1; padding:6px; font-size:0.8rem;" onclick="app.dmNpcSetMode('created')">👿 Adicionar Criado</button>
          <button id="dm-npc-btn-bestiary" class="rpg-btn" style="flex:1; padding:6px; font-size:0.8rem;" onclick="app.dmNpcSetMode('bestiary')">Buscar no Bestiário</button>
        </div>

        <!-- MODE 1: CREATED MONSTERS LIST -->
        <div id="dm-npc-form-created" style="display:none;">
          <div style="margin-bottom:8px;">
            <input type="text" id="dm-npc-created-search" class="rpg-input" placeholder="Filtrar por nome..." oninput="app.dmNpcRenderCreatedList()" style="width:100%;">
          </div>
          <div id="dm-npc-created-list" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;"></div>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem; border-top:1px solid rgba(212,175,55,0.1); padding-top:10px;">
            <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Fechar</button>
          </div>
        </div>

        <!-- MODE 2: BESTIARY FORM -->
        <div id="dm-npc-form-bestiary">
          <div class="rpg-form-group">
            <label class="rpg-label">Pesquisar Monstro (MM & Níveis Épicos)</label>
            <input type="text" id="dm-npc-search" class="rpg-input" placeholder="Digite para buscar... (ex: Ogro, Behemoth)" oninput="app.dmNpcFilterMonsters(this.value)">
          </div>
          
          <div class="rpg-form-group">
            <label class="rpg-label">Selecionar Criatura</label>
            <select id="dm-npc-select" class="rpg-select" style="width:100%;" onchange="app.dmNpcOnSelectMonster(this.value)">
              <!-- Populated dynamically -->
            </select>
          </div>

          <!-- Progressed Monster details -->
          <div id="dm-npc-monster-details" style="display:none; background:rgba(212,175,55,0.03); border:var(--border-gold); padding:10px; border-radius:6px; margin-top:15px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem; border-bottom:1px solid rgba(212,175,55,0.1); padding-bottom:4px;">
              <span id="dm-npc-det-source" style="font-weight:bold; color:var(--accent-gold);">Origem</span>
              <span id="dm-npc-det-type" style="color:var(--text-muted);">Tipo</span>
            </div>
            
            <div style="display:flex; gap:15px; align-items:center; margin-bottom:12px;">
              <div style="flex:1;">
                <label class="rpg-label" style="margin-bottom:2px;">Dados de Vida (HD / Nível)</label>
                <div style="display:flex; gap:10px; align-items:center;">
                  <input type="number" id="dm-npc-det-hd" class="rpg-input" style="padding:4px; text-align:center; width:80px;" min="1" max="200" oninput="app.dmNpcOnAdjustHD(this.value)">
                  <span style="font-size:0.8rem; color:var(--text-muted);" id="dm-npc-det-hd-base">Base: 1</span>
                </div>
              </div>
              <div style="flex:1; text-align:left;">
                <span class="detail-label" style="font-size:0.75rem;">Ataque Padrão:</span>
                <div id="dm-npc-det-attacks" style="font-size:0.8rem; font-style:italic; overflow:hidden; text-overflow:ellipsis; max-width:200px;" title="">Ataque</div>
              </div>
            </div>

            <!-- Recalculated stats grid -->
            <div class="grid-4" style="background:rgba(0,0,0,0.3); border-radius:4px; padding:8px; text-align:center; font-size:0.85rem;">
              <div>
                <div style="font-size:0.75rem; color:var(--text-muted);">HP Progressivo</div>
                <strong id="dm-npc-prog-hp" style="font-size:1.2rem; color:#ff6666;">-</strong>
              </div>
              <div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Classe Armadura</div>
                <strong id="dm-npc-prog-ac" style="font-size:1.2rem; color:#66ff66;">-</strong>
              </div>
              <div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Iniciativa Mod.</div>
                <strong id="dm-npc-prog-init" style="font-size:1.2rem; color:#66ccff;">-</strong>
              </div>
              <div>
                <div style="font-size:0.75rem; color:var(--text-muted);">Desafio (ND)</div>
                <strong id="dm-npc-prog-cr" style="font-size:1.2rem; color:var(--accent-gold);">-</strong>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem; border-top:1px solid rgba(212,175,55,0.1); padding-top:10px;">
            <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Fechar</button>
            <button class="rpg-btn" id="dm-npc-add-bestiary-btn" onclick="app.dmCreateMonsterCombatant()" disabled>Adicionar Ameaça</button>
          </div>
        </div>
      </div>
    `;

    this.dmNpcSetMode('bestiary'); // default to bestiary
    this.dmNpcFilterMonsters(''); // populate initially
    this.showModal();
  }

  dmNpcSetMode(mode) {
    const createdBtn = document.getElementById('dm-npc-btn-created');
    const bestiaryBtn = document.getElementById('dm-npc-btn-bestiary');
    const createdForm = document.getElementById('dm-npc-form-created');
    const bestiaryForm = document.getElementById('dm-npc-form-bestiary');

    if (!createdBtn || !bestiaryBtn || !createdForm || !bestiaryForm) return;

    if (mode === 'created') {
      createdBtn.classList.remove('rpg-btn-secondary');
      bestiaryBtn.classList.add('rpg-btn-secondary');
      createdForm.style.display = 'block';
      bestiaryForm.style.display = 'none';
      this.dmNpcRenderCreatedList();
    } else {
      createdBtn.classList.add('rpg-btn-secondary');
      bestiaryBtn.classList.remove('rpg-btn-secondary');
      createdForm.style.display = 'none';
      bestiaryForm.style.display = 'block';
    }
  }

  dmNpcRenderCreatedList() {
    const container = document.getElementById('dm-npc-created-list');
    if (!container) return;

    const q = (document.getElementById('dm-npc-created-search')?.value || '').toLowerCase().trim();
    const list = (this.customMonsters || []).filter(m => !q || m.name.toLowerCase().includes(q));

    if (list.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">Nenhum monstro criado encontrado.<br><small>Crie monstros na aba "Criador de Inimigos".</small></div>`;
      return;
    }

    container.innerHTML = list.map(m => {
      const imgUrl = m.avatar && m.avatar !== 'rpg-icon.png' ? m.avatar : null;
      const lvl = m.level || m.baseHD || '?';
      const initSign = (m.baseInitMod || 0) >= 0 ? `+${m.baseInitMod || 0}` : `${m.baseInitMod}`;
      return `
        <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.25); border:1px solid rgba(212,175,55,0.2); border-radius:6px; padding:8px 10px; cursor:pointer; transition:background 0.2s;"
          onmouseover="this.style.background='rgba(212,175,55,0.08)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'"
          onclick="app.dmNpcAddCreatedToCombat('${m.id}')">
          ${imgUrl
            ? `<img src="${imgUrl}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid rgba(212,175,55,0.3); flex-shrink:0;">`
            : `<div style="width:36px; height:36px; border-radius:50%; background:rgba(212,175,55,0.1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">👿</div>`
          }
          <div style="flex:1; min-width:0;">
            <div style="font-weight:bold; color:var(--accent-gold); font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${m.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">HP: ${m.baseHp} &nbsp;|&nbsp; CA: ${m.baseAc} &nbsp;|&nbsp; Init: ${initSign} &nbsp;|&nbsp; Nv: ${lvl}</div>
          </div>
          <div style="flex-shrink:0; font-size:0.75rem; color:#aaffaa; background:rgba(0,128,0,0.15); border:1px solid rgba(0,200,0,0.2); border-radius:4px; padding:3px 8px;">Adicionar</div>
        </div>`;
    }).join('');
  }

  dmNpcAddCreatedToCombat(monsterId) {
    const m = this.customMonsters.find(mon => mon.id === monsterId);
    if (!m) return;

    const saves = m.saves || { fort: 0, ref: 0, will: 0 };
    const actionsMax = m.actionsMax !== undefined ? m.actionsMax : 1;

    this.dmCombatants.push({
      name: m.name,
      type: 'npc',
      maxHp: m.baseHp || 10,
      currentHp: m.baseHp || 10,
      ac: m.baseAc || 10,
      rm: m.rm || 0,
      initMod: m.baseInitMod || 0,
      level: m.level || m.baseHD || 1,
      baseHD: m.level || m.baseHD || 1,
      actionsMax: actionsMax,
      initRoll: '',
      conditions: [],
      buffs: [],
      customBuffs: m.buffs || [],
      customDebuffs: m.debuffs || [],
      saves: saves,
      weapons: m.weapons || [],
      spells: m.spells || [],
      specials: m.specials || [],
      avatar: m.avatar || null
    });

    this.saveCombatState();
    this.closeModal();
    this.renderDMCombatTracker();
  }

  dmNpcFilterMonsters(query) {
    const select = document.getElementById('dm-npc-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecione um monstro --</option>';
    const q = query.toLowerCase().trim();

    // 1. Monstros customizados criados pelo Mestre
    const customGroup = document.createElement('optgroup');
    customGroup.label = "👿 Monstros Criados (Mestre)";
    let hasCustom = false;
    if (this.customMonsters) {
      this.customMonsters.forEach(m => {
        if (!q || m.name.toLowerCase().includes(q)) {
          const option = document.createElement('option');
          option.value = `custom_${m.id}`;
          option.textContent = `${m.name} (HP: ${m.baseHp} | CA: ${m.baseAc})`;
          customGroup.appendChild(option);
          hasCustom = true;
        }
      });
    }
    if (hasCustom) select.appendChild(customGroup);

    // 2. Monstros oficiais do Bestiário
    const officialGroup = document.createElement('optgroup');
    officialGroup.label = "📖 Bestiário Oficial D&D 3.0";
    for (let k in window.DND3_Monsters) {
      const m = window.DND3_Monsters[k];
      if (!q || m.name.toLowerCase().includes(q) || m.source.toLowerCase().includes(q)) {
        const option = document.createElement('option');
        option.value = k;
        option.textContent = `${m.name} (ND ${m.cr >= 1 ? Math.floor(m.cr) : m.cr} | ${m.source.split(' ')[0]})`;
        officialGroup.appendChild(option);
      }
    }
    select.appendChild(officialGroup);
  }

  dmNpcOnSelectMonster(monsterKey) {
    this.dmNpcSelectedMonster = monsterKey;
    const details = document.getElementById('dm-npc-monster-details');
    const addBtn = document.getElementById('dm-npc-add-bestiary-btn');

    if (!monsterKey) {
      if (details) details.style.display = 'none';
      if (addBtn) addBtn.disabled = true;
      return;
    }

    let m;
    const isCustom = monsterKey.startsWith('custom_');
    if (isCustom) {
      const id = monsterKey.replace('custom_', '');
      m = this.customMonsters.find(mon => mon.id === id);
    } else {
      m = window.DND3_Monsters[monsterKey];
    }

    if (!m) return;

    const baseHD = m.baseHD !== undefined ? m.baseHD : 1;
    const hdSize = m.hdSize !== undefined ? m.hdSize : 8;
    this.dmNpcProgressedHD = baseHD;

    // Set UI base values
    document.getElementById('dm-npc-det-source').textContent = m.source || "Criado pelo Mestre";
    document.getElementById('dm-npc-det-type').textContent = `Tipo: ${m.type ? m.type.toUpperCase() : "PERSONALIZADO"}`;
    document.getElementById('dm-npc-det-hd-base').textContent = `Base: ${baseHD} HD (d${hdSize})`;
    const weapsText = this.formatWeaponsText(m.weapons || m.attacks);
    document.getElementById('dm-npc-det-attacks').textContent = weapsText;
    document.getElementById('dm-npc-det-attacks').title = weapsText;
    
    const hdInput = document.getElementById('dm-npc-det-hd');
    hdInput.value = baseHD;

    if (details) details.style.display = 'block';
    if (addBtn) addBtn.disabled = false;

    this.dmNpcUpdateProgressedPreview();
  }

  dmNpcOnAdjustHD(hdValue) {
    let hd = parseInt(hdValue);
    if (isNaN(hd) || hd < 1) hd = 1;
    this.dmNpcProgressedHD = hd;
    this.dmNpcUpdateProgressedPreview();
  }

  dmNpcUpdateProgressedPreview() {
    if (!this.dmNpcSelectedMonster) return;
    const progressed = this.calculateProgressedMonster(this.dmNpcSelectedMonster, this.dmNpcProgressedHD);
    if (!progressed) return;

    document.getElementById('dm-npc-prog-hp').textContent = progressed.hp;
    document.getElementById('dm-npc-prog-ac').textContent = progressed.ac;
    
    const sign = progressed.initMod >= 0 ? `+${progressed.initMod}` : progressed.initMod;
    document.getElementById('dm-npc-prog-init').textContent = sign;
    document.getElementById('dm-npc-prog-cr').textContent = progressed.cr;
  }

  calculateProgressedMonster(monsterKey, targetHD) {
    let m;
    const isCustom = monsterKey.startsWith('custom_');
    if (isCustom) {
      const id = monsterKey.replace('custom_', '');
      m = this.customMonsters.find(mon => mon.id === id);
    } else {
      m = window.DND3_Monsters[monsterKey];
    }

    if (!m) return null;

    const baseHD = m.baseHD !== undefined ? m.baseHD : 1;
    const diffHD = targetHD - baseHD;

    // HP calculation: baseHp + diffHD * (average_of_die + Con_modifier).
    const conBase = m.attributes ? m.attributes.con : 10;
    const conMod = conBase > 0 ? Math.floor((conBase - 10) / 2) : 0;
    const hdSize = m.hdSize !== undefined ? m.hdSize : 8;
    const hdAvg = hdSize / 2 + 0.5;
    
    let extraHp = 0;
    if (diffHD !== 0) {
      extraHp = diffHD * Math.max(1, hdAvg + conMod);
    }
    const baseHp = m.baseHp !== undefined ? m.baseHp : (m.hp || 10);
    const hp = Math.max(1, Math.round(baseHp + extraHp));

    // AC calculation: natural armor increases by +1 for every 3 HD added (typical progression)
    let acBonus = diffHD > 0 ? Math.floor(diffHD / 3) : 0;
    if (diffHD < 0) {
      acBonus = Math.floor(diffHD / 3);
    }
    const baseAc = m.baseAc !== undefined ? m.baseAc : 10;
    const ac = Math.max(5, baseAc + acBonus);

    // CR calculation: typically +1 CR for every 3 extra HD
    let crBonus = diffHD > 0 ? Math.floor(diffHD / 3) : 0;
    if (diffHD < 0) {
      crBonus = Math.floor(diffHD / 3);
    }
    const crBase = m.cr !== undefined ? m.cr : 1;
    let cr = Math.max(0.1, crBase + crBonus);

    return {
      name: `${m.name} (HD: ${targetHD})`,
      hp: hp,
      ac: ac,
      initMod: m.baseInitMod || 0,
      cr: cr >= 1 ? Math.floor(cr) : cr.toFixed(2)
    };
  }

  dmCreateMonsterCombatant() {
    if (!this.dmNpcSelectedMonster) return;
    
    const progressed = this.calculateProgressedMonster(this.dmNpcSelectedMonster, this.dmNpcProgressedHD);
    if (!progressed) return;

    let mTemplate;
    const isCustom = this.dmNpcSelectedMonster.startsWith('custom_');
    if (isCustom) {
      const id = this.dmNpcSelectedMonster.replace('custom_', '');
      mTemplate = this.customMonsters.find(mon => mon.id === id);
    } else {
      mTemplate = window.DND3_Monsters[this.dmNpcSelectedMonster];
    }

    if (!mTemplate) return;

    // Calcular testes de resistência baseados no progresso de HD para monstros oficiais
    let saves = { fort: 0, ref: 0, will: 0 };
    if (isCustom) {
      saves = mTemplate.saves || { fort: 0, ref: 0, will: 0 };
    } else {
      const hd = this.dmNpcProgressedHD;
      const attr = mTemplate.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      
      const fortMod = Math.floor(((attr.con || 10) - 10) / 2);
      const refMod = Math.floor(((attr.dex || 10) - 10) / 2);
      const willMod = Math.floor(((attr.wis || 10) - 10) / 2);
      
      const goodSaves = mTemplate.goodSaves || [];
      
      saves.fort = (goodSaves.includes('fort') ? (2 + Math.floor(hd / 2)) : Math.floor(hd / 3)) + fortMod;
      saves.ref = (goodSaves.includes('ref') ? (2 + Math.floor(hd / 2)) : Math.floor(hd / 3)) + refMod;
      saves.will = (goodSaves.includes('will') ? (2 + Math.floor(hd / 2)) : Math.floor(hd / 3)) + willMod;
    }

    this.dmCombatants.push({
      name: progressed.name,
      type: "npc",
      maxHp: progressed.hp,
      currentHp: progressed.hp,
      ac: progressed.ac,
      rm: mTemplate.rm || 0,
      initMod: progressed.initMod,
      level: this.dmNpcProgressedHD || mTemplate.baseHD || 1,
      baseHD: this.dmNpcProgressedHD || mTemplate.baseHD || 1,
      initRoll: "",
      conditions: [],
      buffs: [],
      customBuffs: mTemplate.buffs || [],
      customDebuffs: mTemplate.debuffs || [],
      saves: saves,
      weapons: mTemplate.weapons || mTemplate.attacks || "",
      spells: mTemplate.spells || "",
      specials: mTemplate.specials || "",
      avatar: mTemplate.avatar || null
    });

    this.saveCombatState();
    this.closeModal();
    this.renderDMCombatTracker();
  }

  dmAddPlayerToCombat() {
    const val = document.getElementById('dm-select-player').value;
    if (!val) return;

    const char = this.savedCharacters.find(p => p.id === val);
    if (!char) return;

    const stats = this.calculateActiveStats(char);

    // Prevent duplicates in same combat
    if (this.dmCombatants.some(c => c.charId === char.id)) {
      alert("Este aventureiro já está no combate!");
      return;
    }

    this.dmCombatants.push({
      charId: char.id,
      name: char.name,
      type: "player",
      maxHp: stats.maxHp,
      currentHp: char.currentHp,
      ac: stats.ac,
      initMod: stats.initiative,
      initRoll: "",
      conditions: []
    });

    this.saveCombatState();
    this.closeModal();
    this.renderDMCombatTracker();
  }

  dmCreateNPCCombatant() {
    const name = document.getElementById('dm-npc-name').value.trim();
    if (!name) {
      alert("Dê um nome ao monstro!");
      return;
    }

    const hp = parseInt(document.getElementById('dm-npc-hp').value) || 10;
    const ac = parseInt(document.getElementById('dm-npc-ac').value) || 10;
    const initMod = parseInt(document.getElementById('dm-npc-init-mod').value) || 0;

    this.dmCombatants.push({
      name: name,
      type: "npc",
      maxHp: hp,
      currentHp: hp,
      ac: ac,
      initMod: initMod,
      initRoll: "",
      conditions: []
    });

    this.saveCombatState();
    this.closeModal();
    this.renderDMCombatTracker();
  }

  dmRemoveCombatant(idx) {
    this.dmCombatants.splice(idx, 1);
    
    // Adjust turn index if needed
    if (this.dmTurnIndex >= this.dmCombatants.length) {
      this.dmTurnIndex = 0;
    }

    this.saveCombatState();
    this.renderDMCombatTracker();
  }

  dmUpdateCombatantHp(idx, val) {
    const nextHp = parseInt(val) || 0;
    const c = this.dmCombatants[idx];
    if (!c) return;

    const wasAlreadyDefeated = c.currentHp <= 0;
    c.currentHp = nextHp;
    if (c.type !== 'player') {
      c.maxHp = nextHp; // Atualiza a quantidade total de HP do monstro ao alterar manualmente
    }

    if (nextHp <= 0 && !wasAlreadyDefeated) {
      const charName = c.name;
      this.lastDefeatedEvent = { charName: charName, time: Date.now() };
      this.triggerDefeatedAnimation(charName);
    }

    this.saveCombatState();

    // Sync to character sheet if it's a player
    if (c.type === 'player' && c.charId) {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) {
        char.currentHp = nextHp;
        this.saveCharactersState();
      }
    }

    this.renderDMCombatTracker();
  }

  dmApplyDmgHeal(idx, sign) {
    const c = this.dmCombatants[idx];
    if (!c) return;

    const amtInput = document.getElementById(`dmg-heal-amt-${idx}`);
    const amt = parseInt(amtInput.value) || 0;
    if (amt <= 0) return;

    const wasAlreadyDefeated = c.currentHp <= 0;
    let nextHp = c.currentHp + (amt * sign);
    if (nextHp > c.maxHp) nextHp = c.maxHp;
    if (nextHp < -10) nextHp = -10; // dies at -10 in D&D 3.0

    c.currentHp = nextHp;

    if (nextHp <= 0 && !wasAlreadyDefeated) {
      const charName = c.name;
      this.lastDefeatedEvent = { charName: charName, time: Date.now() };
      this.triggerDefeatedAnimation(charName);
    }

    this.saveCombatState();

    // Sync to character sheet if it's a player
    if (c.type === 'player' && c.charId) {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) {
        char.currentHp = nextHp;
        this.saveCharactersState();
      }
    }

    // Clear input
    amtInput.value = "";
    this.renderDMCombatTracker();
  }

  dmAddQuickPlayer() {
    const val = document.getElementById('dm-quick-select-player').value;
    if (!val) return;

    const char = this.savedCharacters.find(p => p.id === val);
    if (!char) return;

    const stats = this.calculateActiveStats(char);

    // Prevent duplicates in same combat
    if (this.dmCombatants.some(c => c.charId === char.id)) {
      alert("Este aventureiro já está no combate!");
      return;
    }

    this.dmCombatants.push({
      charId: char.id,
      name: char.name,
      type: "player",
      level: char.level || 1,
      class: char.class || 'fighter',
      actionsMax: this.getCombatantMaxActions(char),
      actionsUsed: 0,
      maxHp: stats.maxHp,
      currentHp: char.currentHp,
      ac: stats.ac,
      initMod: stats.initiative,
      initRoll: "",
      conditions: []
    });

    this.autoSortInitiative();
    this.saveCombatState();
    this.logAction(`Adicionou o jogador ${char.name} ao combate.`);
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  dmSceneOnSelectMonster(monsterKey) {
    const summaryEl = document.getElementById('dm-scene-monster-summary');
    if (!summaryEl) return;

    if (!monsterKey) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
      return;
    }

    const m = window.DND3_Monsters[monsterKey];
    if (!m) return;

    // Spell select options
    let spellsSection = "";
    if (m.spells && m.spells.length > 0) {
      spellsSection = `
        <div style="margin-top:5px; border-top:1px dashed rgba(212,175,55,0.25); padding-top:5px;">
          <strong style="color:var(--accent-gold); display:block; margin-bottom:3px;">Magias Disponíveis:</strong>
          <select id="dm-scene-monster-spell-select" class="rpg-select" style="width:100%; font-size:0.75rem; height:24px; padding:2px;" onchange="app.dmSceneOnSelectSpell(this.value)">
            <option value="">-- Selecione uma magia --</option>
            ${m.spells.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <div id="dm-scene-spell-save-info" style="margin-top:5px; font-size:0.75rem; color:#fff; font-weight:bold; display:none;">
            Teste de Resistência: <span id="dm-scene-spell-save-text" style="color:var(--accent-gold);"></span>
          </div>
        </div>
      `;
    } else {
      spellsSection = `
        <div style="margin-top:5px; border-top:1px dashed rgba(212,175,55,0.25); padding-top:5px; color:#888; font-style:italic;">
          Nenhuma magia disponível
        </div>
      `;
    }

    const attrs = m.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    summaryEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:8px;">
          <div style="flex:2;">
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">Nome do Monstro</label>
            <input type="text" id="dm-edit-monster-name" class="rpg-input" value="${m.name}" style="font-size:0.8rem; height:28px; padding:2px 6px;">
          </div>
          <div style="flex:1;">
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">ND</label>
            <input type="number" id="dm-edit-monster-cr" class="rpg-input" value="${m.cr || 1}" step="0.25" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <div>
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">HP Máx</label>
            <input type="number" id="dm-edit-monster-hp" class="rpg-input" value="${m.hp || m.baseHp || 15}" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
          <div>
            <label class="rpg-label" style="font-size:0.7rem; margin:0; white-space:nowrap;">Classe de Armadura</label>
            <input type="number" id="dm-edit-monster-ac" class="rpg-input" value="${m.ac || m.baseAc || 15}" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
        </div>
        <label class="rpg-label" style="font-size:0.7rem; margin:0;">Atributos</label>
        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px; text-align:center;">
          <div><span style="font-size:0.65rem; color:var(--text-muted);">FOR</span><input type="number" id="dm-edit-monster-str" class="rpg-input" value="${attrs.str}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">DES</span><input type="number" id="dm-edit-monster-dex" class="rpg-input" value="${attrs.dex}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">CON</span><input type="number" id="dm-edit-monster-con" class="rpg-input" value="${attrs.con}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">INT</span><input type="number" id="dm-edit-monster-int" class="rpg-input" value="${attrs.int}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">SAB</span><input type="number" id="dm-edit-monster-wis" class="rpg-input" value="${attrs.wis}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">CAR</span><input type="number" id="dm-edit-monster-cha" class="rpg-input" value="${attrs.cha}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
        </div>
        <div>
          <label class="rpg-label" style="font-size:0.7rem; margin:0;">Ataques & Dano (um por linha)</label>
          <textarea id="dm-edit-monster-attacks" class="rpg-textarea" style="font-size:0.8rem; padding:4px 6px; height:60px; resize:vertical; font-family:var(--font-body);">${(m.attacks || '').replace(/,\s*/g, '\n')}</textarea>
        </div>
        ${spellsSection}
      </div>
    `;
    summaryEl.style.display = 'flex';
  }

  dmSceneOnSelectSpell(spellName) {
    const saveInfoEl = document.getElementById('dm-scene-spell-save-info');
    const saveTextEl = document.getElementById('dm-scene-spell-save-text');
    if (!saveInfoEl || !saveTextEl) return;

    if (!spellName) {
      saveInfoEl.style.display = 'none';
      saveTextEl.textContent = '';
      return;
    }

    const spellsSaveMap = {
      "Harm (Mutilação)": "Vontade (metade do dano)",
      "Implosion (Implosão)": "Fortitude (anula)",
      "Destruction (Destruição)": "Fortitude (parcial, 10d6 de dano se passar)",
      "Wail of the Banshee (Lamento da Banshee)": "Fortitude (anula)",
      "Fireball (Bola de Fogo)": "Reflexos (metade do dano)",
      "Haste (Velocidade)": "Nenhum (inofensivo)",
      "Shield (Escudo)": "Nenhum (inofensivo)",
      "Mage Armor (Armadura Arcana)": "Nenhum (inofensivo)",
      "Hold Person (Imobilizar Pessoa)": "Vontade (anula)",
      "Charm Person (Enfeitiçar Pessoa)": "Vontade (anula)",
      "Lightning Bolt (Relâmpago)": "Reflexos (metade do dano)"
    };

    const saveText = spellsSaveMap[spellName] || "Nenhum";
    saveTextEl.textContent = saveText;
    saveInfoEl.style.display = 'block';
  }

  setSceneMonsterMode(mode) {
    const manualForm = document.getElementById('dm-scene-monster-manual');
    const bestiaryForm = document.getElementById('dm-scene-monster-bestiary');
    const manualBtn = document.getElementById('dm-scene-monster-btn-manual');
    const bestiaryBtn = document.getElementById('dm-scene-monster-btn-bestiary');
    
    if (!manualForm || !bestiaryForm || !manualBtn || !bestiaryBtn) return;

    if (mode === 'manual') {
      manualForm.style.display = 'flex';
      bestiaryForm.style.display = 'none';
      manualBtn.classList.remove('rpg-btn-secondary');
      bestiaryBtn.classList.add('rpg-btn-secondary');
    } else {
      manualForm.style.display = 'none';
      bestiaryForm.style.display = 'flex';
      manualBtn.classList.add('rpg-btn-secondary');
      bestiaryBtn.classList.remove('rpg-btn-secondary');
    }
  }

  dmSceneFilterMonsters(query) {
    const select = document.getElementById('dm-scene-monster-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecione o Monstro --</option>';
    const q = query.toLowerCase().trim();

    for (let k in window.DND3_Monsters) {
      const m = window.DND3_Monsters[k];
      if (!q || m.name.toLowerCase().includes(q) || m.source.toLowerCase().includes(q)) {
        const option = document.createElement('option');
        option.value = k;
        option.textContent = `${m.name} (ND ${m.cr >= 1 ? Math.floor(m.cr) : m.cr} | ${m.source.split(' ')[0]})`;
        select.appendChild(option);
      }
    }
  }

  dmSceneFilterCustomMonsters(query) {
    const select = document.getElementById('dm-scene-monster-custom-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Selecione o Monstro --</option>';
    const q = query.toLowerCase().trim();

    const filtered = (this.customMonsters || []).filter(m => !q || m.name.toLowerCase().includes(q));
    filtered.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.name} (ND ${m.level || 1})`;
      select.appendChild(option);
    });
  }

  dmSceneOnSelectCustomMonster(monsterId) {
    const summaryEl = document.getElementById('dm-scene-monster-custom-summary');
    if (!summaryEl) return;

    if (!monsterId) {
      summaryEl.style.display = 'none';
      summaryEl.innerHTML = '';
      return;
    }

    const m = this.customMonsters.find(mon => mon.id === monsterId);
    if (!m) return;

    let spellsSection = "";
    if (m.spells && m.spells.length > 0) {
      spellsSection = `
        <div style="margin-top:5px; border-top:1px dashed rgba(212,175,55,0.25); padding-top:5px;">
          <strong style="color:var(--accent-gold); display:block; margin-bottom:3px;">Magias Disponíveis:</strong>
          <select id="dm-scene-monster-custom-spell-select" class="rpg-select" style="width:100%; font-size:0.75rem; height:24px; padding:2px;" onchange="app.dmSceneOnSelectCustomSpell(this.value)">
            <option value="">-- Selecione uma magia --</option>
            ${m.spells.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <div id="dm-scene-custom-spell-save-info" style="margin-top:5px; font-size:0.75rem; color:#fff; font-weight:bold; display:none;">
            Teste de Resistência: <span id="dm-scene-custom-spell-save-text" style="color:var(--accent-gold);"></span>
          </div>
        </div>
      `;
    } else {
      spellsSection = `
        <div style="margin-top:5px; border-top:1px dashed rgba(212,175,55,0.25); padding-top:5px; color:#888; font-style:italic;">
          Nenhuma magia disponível
        </div>
      `;
    }

    const attrs = m.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

    let attacksStr = "";
    if (Array.isArray(m.weapons)) {
      attacksStr = m.weapons.map(w => {
        const bonus = (w.atkBonus !== undefined ? w.atkBonus : (w.atk !== undefined ? w.atk : 0));
        const totalBonus = bonus + (w.magicBonus || 0);
        const totalBonusStr = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
        const totalDmgBonus = (w.dmgBonus || 0) + (w.magicBonus || 0);
        const totalDmgBonusStr = totalDmgBonus > 0 ? `+${totalDmgBonus}` : (totalDmgBonus < 0 ? `${totalDmgBonus}` : '');
        const effectStr = w.effect ? `, ${w.effect}` : '';
        return `${w.name} (${totalBonusStr} | ${w.diceCount}d${w.diceSize}${totalDmgBonusStr}${effectStr})`;
      }).join('\n');
    } else {
      attacksStr = (m.attacks || m.weapons || "").replace(/,\s*/g, '\n');
    }

    summaryEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:8px;">
          <div style="flex:2;">
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">Nome do Monstro</label>
            <input type="text" id="dm-edit-monster-custom-name" class="rpg-input" value="${m.name}" style="font-size:0.8rem; height:28px; padding:2px 6px;">
          </div>
          <div style="flex:1;">
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">ND</label>
            <input type="number" id="dm-edit-monster-custom-cr" class="rpg-input" value="${m.level || m.cr || 1}" step="0.25" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <div>
            <label class="rpg-label" style="font-size:0.7rem; margin:0;">HP Máx</label>
            <input type="number" id="dm-edit-monster-custom-hp" class="rpg-input" value="${m.hp || m.baseHp || 15}" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
          <div>
            <label class="rpg-label" style="font-size:0.7rem; margin:0; white-space:nowrap;">Classe de Armadura</label>
            <input type="number" id="dm-edit-monster-custom-ac" class="rpg-input" value="${m.ac || m.baseAc || 15}" style="font-size:0.8rem; height:28px; padding:2px 6px; text-align:center;">
          </div>
        </div>
        <label class="rpg-label" style="font-size:0.7rem; margin:0;">Atributos</label>
        <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px; text-align:center;">
          <div><span style="font-size:0.65rem; color:var(--text-muted);">FOR</span><input type="number" id="dm-edit-monster-custom-str" class="rpg-input" value="${attrs.str}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">DES</span><input type="number" id="dm-edit-monster-custom-dex" class="rpg-input" value="${attrs.dex}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">CON</span><input type="number" id="dm-edit-monster-custom-con" class="rpg-input" value="${attrs.con}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">INT</span><input type="number" id="dm-edit-monster-custom-int" class="rpg-input" value="${attrs.int}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">SAB</span><input type="number" id="dm-edit-monster-custom-wis" class="rpg-input" value="${attrs.wis}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
          <div><span style="font-size:0.65rem; color:var(--text-muted);">CAR</span><input type="number" id="dm-edit-monster-custom-cha" class="rpg-input" value="${attrs.cha}" style="font-size:0.75rem; height:24px; padding:1px; text-align:center;"></div>
        </div>
        <div>
          <label class="rpg-label" style="font-size:0.7rem; margin:0;">Ataques & Dano (um por linha)</label>
          <textarea id="dm-edit-monster-custom-attacks" class="rpg-textarea" style="font-size:0.8rem; padding:4px 6px; height:60px; resize:vertical; font-family:var(--font-body);">${attacksStr}</textarea>
        </div>
        ${spellsSection}
      </div>
    `;
    summaryEl.style.display = 'flex';
  }

  dmSceneOnSelectCustomSpell(spellName) {
    const saveInfoEl = document.getElementById('dm-scene-custom-spell-save-info');
    const saveTextEl = document.getElementById('dm-scene-custom-spell-save-text');
    if (!saveInfoEl || !saveTextEl) return;

    if (!spellName) {
      saveInfoEl.style.display = 'none';
      saveTextEl.textContent = '';
      return;
    }

    const spellsSaveMap = {
      "Harm (Mutilação)": "Vontade (metade do dano)",
      "Implosion (Implosão)": "Fortitude (anula)",
      "Destruction (Destruição)": "Fortitude (parcial, 10d6 de dano se passar)",
      "Wail of the Banshee (Lamento da Banshee)": "Fortitude (anula)",
      "Fireball (Bola de Fogo)": "Reflexos (metade do dano)",
      "Haste (Velocidade)": "Nenhum (inofensivo)",
      "Shield (Escudo)": "Nenhum (inofensivo)",
      "Mage Armor (Armadura Arcana)": "Nenhum (inofensivo)",
      "Hold Person (Imobilizar Pessoa)": "Vontade (anula)",
      "Charm Person (Enfeitiçar Pessoa)": "Vontade (anula)",
      "Lightning Bolt (Relâmpago)": "Reflexos (metade do dano)"
    };

    const saveText = spellsSaveMap[spellName] || "Nenhum";
    saveTextEl.textContent = saveText;
    saveInfoEl.style.display = 'block';
  }

  dmAddSceneMonsterCustom() {
    const selectEl = document.getElementById('dm-scene-monster-custom-select');
    if (!selectEl) return;

    const monsterId = selectEl.value;
    if (!monsterId) {
      alert("Por favor, selecione um monstro criado pelo mestre.");
      return;
    }

    const nameVal = document.getElementById('dm-edit-monster-custom-name')?.value.trim() || "Monstro do Mestre";
    const hpVal = parseInt(document.getElementById('dm-edit-monster-custom-hp')?.value) || 15;
    const acVal = parseInt(document.getElementById('dm-edit-monster-custom-ac')?.value) || 15;
    const crVal = parseFloat(document.getElementById('dm-edit-monster-custom-cr')?.value) || 1;
    const attacksVal = document.getElementById('dm-edit-monster-custom-attacks')?.value || "";
    
    const strVal = parseInt(document.getElementById('dm-edit-monster-custom-str')?.value) || 10;
    const dexVal = parseInt(document.getElementById('dm-edit-monster-custom-dex')?.value) || 10;
    const conVal = parseInt(document.getElementById('dm-edit-monster-custom-con')?.value) || 10;
    const intVal = parseInt(document.getElementById('dm-edit-monster-custom-int')?.value) || 10;
    const wisVal = parseInt(document.getElementById('dm-edit-monster-custom-wis')?.value) || 10;
    const chaVal = parseInt(document.getElementById('dm-edit-monster-custom-cha')?.value) || 10;

    const m = this.customMonsters.find(mon => mon.id === monsterId);
    const initMod = m ? (m.baseInitMod || 0) : 0;
    const weapons = m ? (m.weapons || []) : [];
    const spells = m ? (m.spells || []) : [];
    const specials = m ? (m.specials || []) : [];
    const avatar = m ? (m.avatar || "rpg-icon.png") : "rpg-icon.png";

    this.dmCombatants.push({
      name: nameVal,
      type: "npc",
      maxHp: hpVal,
      currentHp: hpVal,
      ac: acVal,
      cr: crVal,
      level: crVal,
      baseHD: crVal,
      actionsMax: m ? (m.actionsMax || 1) : 1,
      initMod: initMod,
      initRoll: "",
      conditions: [],
      attributes: { str: strVal, dex: dexVal, con: conVal, int: intVal, wis: wisVal, cha: chaVal },
      attacks: attacksVal,
      weapons: weapons,
      spells: spells,
      specials: specials,
      buffs: [],
      customBuffs: m ? (m.buffs || []) : [],
      customDebuffs: m ? (m.debuffs || []) : [],
      saves: m ? (m.saves || { fort: 0, ref: 0, will: 0 }) : { fort: 0, ref: 0, will: 0 },
      avatar: avatar,
      damageByPlayer: {}
    });

    this.saveCombatState();
    this.logAction(`Adicionou monstro customizado ${nameVal} em cena.`);
    
    // Clear select and hide summary
    selectEl.value = "";
    document.getElementById('dm-scene-monster-custom-summary').style.display = 'none';

    this.renderDMCombatTracker();
    this.showToast(`Monstro ${nameVal} adicionado em cena.`);
  }

  dmAddSceneMonsterBestiary() {
    const selectEl = document.getElementById('dm-scene-monster-select');
    if (!selectEl) return;

    const monsterKey = selectEl.value;
    if (!monsterKey) {
      alert("Por favor, selecione um monstro do bestiário.");
      return;
    }

    const nameVal = document.getElementById('dm-edit-monster-name')?.value.trim() || "Monstro";
    const hpVal = parseInt(document.getElementById('dm-edit-monster-hp')?.value) || 15;
    const acVal = parseInt(document.getElementById('dm-edit-monster-ac')?.value) || 15;
    const crVal = parseFloat(document.getElementById('dm-edit-monster-cr')?.value) || 1;
    const attacksVal = document.getElementById('dm-edit-monster-attacks')?.value || "";
    
    const strVal = parseInt(document.getElementById('dm-edit-monster-str')?.value) || 10;
    const dexVal = parseInt(document.getElementById('dm-edit-monster-dex')?.value) || 10;
    const conVal = parseInt(document.getElementById('dm-edit-monster-con')?.value) || 10;
    const intVal = parseInt(document.getElementById('dm-edit-monster-int')?.value) || 10;
    const wisVal = parseInt(document.getElementById('dm-edit-monster-wis')?.value) || 10;
    const chaVal = parseInt(document.getElementById('dm-edit-monster-cha')?.value) || 10;

    const m = window.DND3_Monsters[monsterKey];
    const initMod = m ? (m.baseInitMod || 0) : 0;

    this.dmCombatants.push({
      name: nameVal,
      type: "npc",
      maxHp: hpVal,
      currentHp: hpVal,
      ac: acVal,
      cr: crVal,
      initMod: initMod,
      initRoll: "",
      conditions: [],
      attributes: { str: strVal, dex: dexVal, con: conVal, int: intVal, wis: wisVal, cha: chaVal },
      attacks: attacksVal,
      damageByPlayer: {}
    });

    this.saveCombatState();
    this.logAction(`Adicionou monstro editado ${nameVal} em cena.`);
    
    // Clear select and hide summary
    selectEl.value = "";
    document.getElementById('dm-scene-monster-summary').style.display = 'none';

    this.renderDMCombatTracker();
    this.showToast(`Monstro ${nameVal} adicionado em cena.`);
  }

  dmSaveInitiative(idx, val) {
    const c = this.dmCombatants[idx];
    if (!c) return;
    c.initRoll = val !== "" ? parseInt(val) || 0 : "";
    this.autoSortInitiative();
    this.saveCombatState();
    this.showToast(`Iniciativa de ${c.name} salva.`);
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  dmClearInitiative(idx) {
    const c = this.dmCombatants[idx];
    if (!c) return;
    c.initRoll = "";
    this.autoSortInitiative();
    this.saveCombatState();
    this.showToast(`Iniciativa de ${c.name} apagada.`);
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  dmUpdateTarget(playerIdx, targetName) {
    const c = this.dmCombatants[playerIdx];
    if (!c) return;
    c.targetMonster = targetName;
    this.saveCombatState();
    this.renderDMCombatTracker();
  }

  getBAB(className, level) {
    const lvl = parseInt(level) || 1;
    const cls = (className || '').toLowerCase().trim();

    // Good BAB (1.0 BAB per level)
    const goodBABClasses = [
      'fighter', 'guerreiro', 
      'barbarian', 'barbaro', 'bárbaro', 
      'paladin', 'paladino', 
      'ranger'
    ];
    // Average BAB (0.75 BAB per level)
    const averageBABClasses = [
      'cleric', 'clerigo', 'clérigo', 
      'rogue', 'ladino', 
      'bard', 'bardo', 
      'monk', 'monge', 
      'druid', 'druida'
    ];
    // Poor BAB (0.5 BAB per level)
    const poorBABClasses = [
      'wizard', 'mago', 
      'sorcerer', 'feiticeiro'
    ];

    if (goodBABClasses.includes(cls)) {
      return lvl;
    } else if (averageBABClasses.includes(cls)) {
      return Math.floor(lvl * 0.75);
    } else if (poorBABClasses.includes(cls)) {
      return Math.floor(lvl * 0.5);
    }
    // Default to Good BAB if class is unknown/custom
    return lvl;
  }

  getCombatantMaxActions(c) {
    if (!c) return 1;
    if (c.actionsMax !== undefined && c.actionsMax !== null) return c.actionsMax;
    let charId = c.charId || c.id;
    let className = c.class || 'fighter';
    let level = parseInt(c.level) || 1;

    if (c.type === 'player' || charId) {
      const char = this.savedCharacters.find(ch => ch.id === charId);
      if (char) {
        className = char.class || className;
        level = parseInt(char.level) || level;
      }
    }

    const bab = this.getBAB(className, level);
    if (bab < 6) return 1;
    if (bab < 11) return 2;
    if (bab < 16) return 3;
    return 4; // BAB 16+ yields 4 attacks/actions
  }

  dmIncrementCombatantActions(cIdx, slotIdx = 0) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const maxActions = c.actionsMax !== undefined ? c.actionsMax : this.getCombatantMaxActions(c);
    const usedCount = Array.isArray(c.usedActionSlots) ? c.usedActionSlots.length : (c.actionsUsed || 0);

    if (c.finishedTurn || usedCount >= maxActions) {
      this.showToast("Você já fez todas as suas ações neste turno");
      return;
    }

    if (c.actionsMax === undefined) {
      c.actionsMax = maxActions;
    }
    if (!Array.isArray(c.usedActionSlots)) {
      c.usedActionSlots = [];
    }
    if (!c.usedActionSlots.includes(slotIdx)) {
      c.usedActionSlots.push(slotIdx);
    }
    c.actionsUsed = c.usedActionSlots.length;

    if (c.actionsUsed >= c.actionsMax) {
      c.finishedTurn = true;
    }

    this.saveCombatState();
    this.checkRoundCompletion();
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  autoSortInitiative() {
    if (!this.dmCombatants || !this.dmCombatants.length) return;
    this.dmCombatants.sort((a, b) => {
      if (a.actLast && !b.actLast) return 1;
      if (!a.actLast && b.actLast) return -1;

      const initA = (a.initRoll !== "" && a.initRoll !== undefined && a.initRoll !== null) ? parseInt(a.initRoll) : -99;
      const initB = (b.initRoll !== "" && b.initRoll !== undefined && b.initRoll !== null) ? parseInt(b.initRoll) : -99;
      return initB - initA;
    });
  }

  skipCombatantTurn(idx) {
    const c = this.dmCombatants[idx];
    if (!c) return;

    const max = c.actionsMax !== undefined ? c.actionsMax : this.getCombatantMaxActions(c);
    const used = Array.isArray(c.usedActionSlots) ? c.usedActionSlots.length : (c.actionsUsed || 0);

    if (c.finishedTurn || used >= max) {
      this.showToast("Você já fez todas as suas ações neste turno");
      return;
    }

    c.finishedTurn = true;
    c.actionsMax = max;
    c.actionsUsed = max;
    c.usedActionSlots = Array.from({ length: max }, (_, i) => i);

    this.logAction(`${c.name} pulou o turno.`);
    this.saveCombatState();
    this.checkRoundCompletion();
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
    this.showToast(`${c.name} pulou o turno.`);
  }

  actLastCombatant(idx) {
    const c = this.dmCombatants[idx];
    if (!c) return;

    const max = c.actionsMax !== undefined ? c.actionsMax : this.getCombatantMaxActions(c);
    const used = Array.isArray(c.usedActionSlots) ? c.usedActionSlots.length : (c.actionsUsed || 0);

    if (c.finishedTurn || used >= max) {
      this.showToast("Você já fez todas as suas ações neste turno");
      return;
    }

    c.actLast = true;
    this.logAction(`${c.name} escolheu agir por último nesta rodada.`);
    this.autoSortInitiative();
    this.saveCombatState();
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
    this.showToast(`${c.name} agirá por último nesta rodada.`);
  }

  checkRoundCompletion() {
    if (!this.dmCombatants || !this.dmCombatants.length) return;

    const allFinished = this.dmCombatants.every(c => {
      if (c.currentHp <= 0) return true; // Defeated combatants do not block round progression
      const max = c.actionsMax !== undefined ? c.actionsMax : (this.getCombatantMaxActions(c) || 1);
      const used = Array.isArray(c.usedActionSlots) ? c.usedActionSlots.length : (c.actionsUsed || 0);
      return c.finishedTurn || used >= max;
    });

    if (allFinished) {
      this.advanceToNextRound();
    }
  }

  advanceToNextRound() {
    this.combatRound = (this.combatRound || 1) + 1;
    this.lastRoundMessage = `🔄 Rodada ${this.combatRound} - Próxima Rodada!`;

    // Reset action state for all combatants
    this.dmCombatants.forEach(c => {
      c.finishedTurn = false;
      c.actLast = false;
      c.actionsUsed = 0;
      c.usedActionSlots = [];
      c.actionsMax = this.getCombatantMaxActions(c);
    });

    this.autoSortInitiative();
    this.saveCombatState();
    this.logAction(`--- INÍCIO DA RODADA ${this.combatRound} ---`);

    this.triggerNextRoundBanner(this.combatRound);
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  triggerNextRoundBanner(round) {
    let banner = document.getElementById('next-round-banner-overlay');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'next-round-banner-overlay';
      banner.style.cssText = `
        position: fixed;
        top: 25px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        background: linear-gradient(135deg, #b45309, #78350f);
        color: #fef08a;
        border: 2px solid #fde047;
        padding: 12px 26px;
        border-radius: 999px;
        font-family: var(--font-header, sans-serif);
        font-size: 1.2rem;
        font-weight: 900;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 25px rgba(253,224,71,0.6);
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        pointer-events: none;
        transition: opacity 0.5s ease;
      `;
      document.body.appendChild(banner);
    }

    banner.innerHTML = `⚡ PRÓXIMA RODADA (RODADA ${round}) ⚡`;
    banner.style.opacity = '1';
    banner.style.display = 'block';

    if (this._bannerTimeout) clearTimeout(this._bannerTimeout);
    this._bannerTimeout = setTimeout(() => {
      if (banner) {
        banner.style.opacity = '0';
        setTimeout(() => { banner.style.display = 'none'; }, 500);
      }
    }, 3500);
  }

  dmSortInitiative() {
    this.autoSortInitiative();
    this.saveCombatState();
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  dmNextTurn() {
    this.checkRoundCompletion();
  }

  dmPrevTurn() {
    this.checkRoundCompletion();
  }

  dmClearCombat() {
    this.showCustomConfirm("Deseja apagar todo o combate atual?", () => {
      this.dmCombatants = [];
      this.dmTurnIndex = -1;
      this.combatRound = 1;
      this.inviteActive = false;
      this.playerResponses = {};
      localStorage.removeItem('dnd3_combatants');
      this.logAction(`Limpou a lista de combate.`);
      this.saveCombatState();
      this.renderDMCombatTracker();
      this.renderPlayerCombatTracker();
      this.showToast("Lista de combate limpa.");
    });
  }

  dmSendBattleInvite() {
    this.inviteActive = true;
    this.playerResponses = {};
    
    // Set all players registered locally or online to 'invited'
    if (this.users) {
      this.users.forEach(u => {
        if (this.normalizeRole(u.role) === 'player') {
          this.playerResponses[u.username] = 'invited';
        }
      });
    }

    // Also include any character owners as invited
    if (this.savedCharacters) {
      this.savedCharacters.forEach(c => {
        if (c.owner && !this.playerResponses[c.owner]) {
          this.playerResponses[c.owner] = 'invited';
        }
      });
    }

    this.saveCombatState();
    this.playSound('invite');
    this.logAction("Mestre enviou um convite de batalha para todos os jogadores.");
    this.renderDMCombatTracker();
    this.showToast("Convite de batalha enviado!");
  }

  dmCancelBattleInvite() {
    this.inviteActive = false;
    this.playerResponses = {};
    this.saveCombatState();
    this.playSound('click');
    this.logAction("Mestre cancelou o convite de batalha.");
    this.renderDMCombatTracker();
    this.showToast("Convite cancelado.");
  }

  // CONDITIONS MODIFIER MODAL
  dmManageConditionsModal(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    // Conditions list
    const conditions = ["Aturdido", "Emaranhado", "Fatigado", "Abalado", "Atordoado"];
    
    let checklistHtml = conditions.map(condName => {
      const hasCond = c.conditions.includes(condName);
      return `
        <label style="display:block; padding: 6px; cursor:pointer;">
          <input type="checkbox" id="cond-check-${condName}" ${hasCond ? 'checked' : ''}> ${condName}
        </label>
      `;
    }).join('');

    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
      <h3 style="margin-bottom:1rem; font-family:var(--font-header);">Condições do Turno: ${c.name}</h3>
      <div style="background:rgba(0,0,0,0.3); border:var(--border-gold); padding:10px; border-radius:4px; margin-bottom:1.5rem;">
        ${checklistHtml}
      </div>

      ${(() => {
        let customDebuffsHtml = "";
        if (c.customDebuffs && c.customDebuffs.length > 0) {
          customDebuffsHtml = `
            <div style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; margin-bottom: 15px; text-align: left;">
              <label class="rpg-label" style="font-size:0.8rem; color:#ff6666; display:block; margin-bottom:6px;">Debuffs Pré-Configurados (Clique para Ativar/Desativar):</label>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${c.customDebuffs.map(cd => {
                  const isActive = c.conditions && c.conditions.includes(cd.name);
                  const btnClass = isActive ? 'rpg-btn' : 'rpg-btn rpg-btn-secondary';
                  const btnStyle = isActive 
                    ? 'padding:3px 8px; font-size:0.72rem; background:linear-gradient(135deg, #b91c1c, #7f1d1d); border:none;' 
                    : 'padding:3px 8px; font-size:0.72rem;';
                  return `<button class="${btnClass}" style="${btnStyle}" onclick="app.toggleCustomDebuff(${cIdx}, '${cd.name}')">${cd.name} (${cd.effect})</button>`;
                }).join('')}
              </div>
            </div>
          `;
        }
        return customDebuffsHtml;
      })()}

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button class="rpg-btn" onclick="app.dmSaveConditions(${cIdx})">Salvar Status</button>
      </div>
    `;

    this.showModal();
  }

  dmSaveConditions(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const conditions = ["Aturdido", "Emaranhado", "Fatigado", "Abalado", "Atordoado"];
    c.conditions = [];

    conditions.forEach(cond => {
      const chk = document.getElementById(`cond-check-${cond}`);
      if (chk && chk.checked) {
        c.conditions.push(cond);
      }
    });

    this.saveCombatState();
    this.closeModal();
    this.renderDMCombatTracker();
  }

  // BUFFS MODIFIER MODAL FOR COMBATANTS
  dmManageBuffsModal(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    if (!c.buffs) c.buffs = [];

    const buffsListHtml = c.buffs.length === 0
      ? '<em style="color:var(--text-muted); font-size:0.85rem;">Nenhum buff/benefício ativo.</em>'
      : c.buffs.map((b, bIdx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:4px; margin-bottom:5px; border-left:2px solid #38bdf8;">
          <span style="font-size:0.85rem; color:#66ccff;">✨ ${b}</span>
          <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; background:#8b0000; border:none;" onclick="app.dmRemoveBuffFromCombatant(${cIdx}, ${bIdx})">🗑️</button>
        </div>
      `).join('');

    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
      <h3 style="margin-bottom:1rem; font-family:var(--font-header);">Buffs & Benefícios: ${c.name}</h3>
      
      <div style="margin-bottom:1.2rem;">
        <label class="rpg-label" style="font-size:0.8rem;">Buffs / Benfeitorias Ativas:</label>
        <div style="max-height:150px; overflow-y:auto; background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; border:var(--border-gold);">
          ${buffsListHtml}
        </div>
      </div>

      <div class="rpg-form-group" style="margin-bottom:1.5rem;">
        <label class="rpg-label" style="font-size:0.8rem;">Adicionar Novo Buff / Benefício:</label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="dm-new-buff-input" class="rpg-input" placeholder="Ex: Bênção (+1 ataque), Oração, Armadura Arcana..." style="flex:1; font-size:0.85rem;" onkeypress="if(event.key==='Enter'){event.preventDefault();app.dmAddBuffToCombatant(${cIdx});}">
          <button class="rpg-btn" onclick="app.dmAddBuffToCombatant(${cIdx})">+ Adicionar</button>
        </div>
      </div>

      ${(() => {
        let customBuffsHtml = "";
        if (c.customBuffs && c.customBuffs.length > 0) {
          customBuffsHtml = `
            <div style="margin-top: 15px; border-top: 1px dashed rgba(212,175,55,0.2); padding-top: 10px; margin-bottom: 15px; text-align: left;">
              <label class="rpg-label" style="font-size:0.8rem; color:var(--accent-gold); display:block; margin-bottom:6px;">Buffs Pré-Configurados (Clique para Ativar/Desativar):</label>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${c.customBuffs.map(cb => {
                  const isActive = c.buffs && c.buffs.includes(cb.name);
                  const btnClass = isActive ? 'rpg-btn' : 'rpg-btn rpg-btn-secondary';
                  const btnStyle = isActive 
                    ? 'padding:3px 8px; font-size:0.72rem; background:linear-gradient(135deg, green, #005c00); border:none;' 
                    : 'padding:3px 8px; font-size:0.72rem;';
                  return `<button class="${btnClass}" style="${btnStyle}" onclick="app.toggleCustomBuff(${cIdx}, '${cb.name}')">${cb.name} (${cb.effect})</button>`;
                }).join('')}
              </div>
            </div>
          `;
        }
        return customBuffsHtml;
      })()}

      <div style="display:flex; justify-content:flex-end;">
        <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Fechar</button>
      </div>
    `;

    this.showModal();
  }

  dmAddBuffToCombatant(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;
    const input = document.getElementById('dm-new-buff-input');
    if (!input || !input.value.trim()) return;

    if (!c.buffs) c.buffs = [];
    c.buffs.push(input.value.trim());

    this.saveCombatState();
    this.dmManageBuffsModal(cIdx);
    this.renderDMCombatTracker();
  }

  dmRemoveBuffFromCombatant(cIdx, bIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c || !c.buffs) return;
    c.buffs.splice(bIdx, 1);

    this.saveCombatState();
    this.dmManageBuffsModal(cIdx);
    this.renderDMCombatTracker();
  }

  // ==========================================
  // RPG COMBAT ACTION SYSTEM IMPLEMENTATION
  // ==========================================

  rollDiceExpression(expr) {
    if (!expr || !expr.trim()) return { total: 0, rolls: [], constant: 0, breakdown: "0" };
    
    const cleanExpr = expr.replace(/\s+/g, '').toLowerCase();
    const tokens = cleanExpr.split(/([+-])/);
    
    let total = 0;
    let rolls = [];
    let breakdownParts = [];
    let currentSign = 1;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '+') {
        currentSign = 1;
      } else if (token === '-') {
        currentSign = -1;
      } else {
        const dieMatch = token.match(/^(\d*)d(\d+)$/i);
        if (dieMatch) {
          const qty = parseInt(dieMatch[1]) || (dieMatch[1] === "" ? 1 : parseInt(dieMatch[1]));
          const sides = parseInt(dieMatch[2]);
          const subRolls = [];
          let subTotal = 0;
          for (let q = 0; q < qty; q++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            subRolls.push(roll);
            subTotal += roll;
            rolls.push(roll);
          }
          total += subTotal * currentSign;
          const signStr = currentSign === -1 ? '-' : (breakdownParts.length > 0 ? '+' : '');
          breakdownParts.push(`${signStr}${qty}d${sides} (${subRolls.join(', ')})`);
        } else {
          const constVal = parseInt(token);
          if (!isNaN(constVal)) {
            total += constVal * currentSign;
            const signChar = currentSign === -1 ? '-' : '+';
            breakdownParts.push(`${signChar}${constVal}`);
          }
        }
      }
    }
    
    let breakdown = breakdownParts.join(' ');
    if (breakdown.startsWith('+ ')) {
      breakdown = breakdown.substring(2);
    }
    breakdown += ` = ${total}`;
    
    return { total, rolls, breakdown };
  }

  dmGetCombatantSaveModifier(c, saveType) {
    if (c.type === 'player') {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) {
        const stats = this.calculateActiveStats(char);
        return stats[saveType] || 0;
      }
      return 0;
    }
    
    const modifiedStats = this.getModifiedMonsterStats(c);
    if (modifiedStats && modifiedStats.saves && modifiedStats.saves[saveType] !== undefined) {
      return modifiedStats.saves[saveType];
    }
    
    return 0;
  }

  dmCombatantActionsModal(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    if (c.actionsMax === undefined) {
      c.actionsMax = this.getCombatantMaxActions(c);
    }
    if (c.actionsUsed === undefined) {
      c.actionsUsed = 0;
    }

    if (!Array.isArray(c.usedActionSlots)) {
      c.usedActionSlots = [];
    }

    const isTurn = cIdx === this.dmTurnIndex;
    const noActionsLeft = isTurn && (c.usedActionSlots.length >= c.actionsMax);

    if (!c.buffs) c.buffs = [];
    if (!c.conditions) c.conditions = [];
    if (!this.dmActionLogs) this.dmActionLogs = [];

    const enemies = this.dmCombatants.filter(x => x.type !== c.type);
    const allies = this.dmCombatants.filter(x => x.type === c.type);

    const enemyOptions = enemies.map((e) => {
      const originalIdx = this.dmCombatants.indexOf(e);
      const dispName = this.getCombatantDisplayName(e);
      return `<option value="${originalIdx}">${dispName} (CA ${e.ac})</option>`;
    }).join('') || '<option value="">-- Sem inimigos ativos --</option>';

    const enemyCheckboxes = enemies.map((e) => {
      const originalIdx = this.dmCombatants.indexOf(e);
      const dispName = this.getCombatantDisplayName(e);
      return `
        <label style="display:inline-flex; align-items:center; gap:6px; margin:2px 4px; padding:4px 8px; background:rgba(0,0,0,0.25); border-radius:4px; font-size:0.75rem; cursor:pointer;">
          <input type="checkbox" name="spell-target" value="${originalIdx}"> ${dispName} (CA ${e.ac})
        </label>
      `;
    }).join('') || '<em style="color:var(--text-muted); font-size:0.75rem; padding:8px;">Nenhum inimigo ativo no combate.</em>';

    const allyCheckboxes = allies.map((a) => {
      const originalIdx = this.dmCombatants.indexOf(a);
      const dispName = this.getCombatantDisplayName(a);
      return `
        <label style="display:inline-flex; align-items:center; gap:6px; margin:2px 4px; padding:4px 8px; background:rgba(0,0,0,0.25); border-radius:4px; font-size:0.75rem; cursor:pointer;">
          <input type="checkbox" name="spell-target" value="${originalIdx}"> ${dispName}
        </label>
      `;
    }).join('') || '<em style="color:var(--text-muted); font-size:0.75rem; padding:8px;">Nenhum aliado ativo no combate.</em>';

    const buffCheckboxes = this.dmCombatants.map((x) => {
      const originalIdx = this.dmCombatants.indexOf(x);
      const dispName = this.getCombatantDisplayName(x);
      return `
        <label style="display:inline-flex; align-items:center; gap:6px; margin:2px 4px; padding:4px 8px; background:rgba(0,0,0,0.25); border-radius:4px; font-size:0.75rem; cursor:pointer;">
          <input type="checkbox" name="buff-target" value="${originalIdx}"> ${dispName}
        </label>
      `;
    }).join('');

    const debuffCheckboxes = this.dmCombatants.map((x) => {
      const originalIdx = this.dmCombatants.indexOf(x);
      const dispName = this.getCombatantDisplayName(x);
      return `
        <label style="display:inline-flex; align-items:center; gap:6px; margin:2px 4px; padding:4px 8px; background:rgba(0,0,0,0.25); border-radius:4px; font-size:0.75rem; cursor:pointer;">
          <input type="checkbox" name="debuff-target" value="${originalIdx}"> ${dispName}
        </label>
      `;
    }).join('');

    let attackSelectionHtml = "";
    if (c.type === 'player') {
      const charObj = this.savedCharacters.find(ch => ch.id === c.charId);
      const weapons = charObj && charObj.weapons ? charObj.weapons : [];
      const charStats = charObj ? this.calculateActiveStats(charObj) : null;
      const strMod = charStats ? (charStats.mods ? charStats.mods.str : Math.floor(((parseInt(charObj.abilityStr)||10)-10)/2)) : 0;
      const meleeBonus = charStats ? (charStats.melee || 0) : 0;
      const rangedBonus = charStats ? (charStats.ranged || 0) : 0;

      let weaponOptions = "";
      if (weapons.length === 0 || (weapons.length === 1 && !weapons[0].name)) {
        const formattedMod = strMod >= 0 ? `+${strMod}` : `${strMod}`;
        const totalAtk = meleeBonus >= 0 ? `+${meleeBonus}` : `${meleeBonus}`;
        weaponOptions = `
          <option value="unarmed"
            data-name="Ataque Desarmado"
            data-range="Corpo-a-corpo"
            data-atk="${meleeBonus}"
            data-damage="1d3"
            data-strmod="${strMod}"
            data-magic="0"
            data-crit="20/x2"
          >Ataque Desarmado (Atk: ${totalAtk}, Dano: 1d3${formattedMod})</option>
        `;
      } else {
        weaponOptions = weapons.map((w, wIdx) => {
          const isRanged = w.range && w.range !== 'Corpo-a-corpo';
          const totalAtkBonus = isRanged ? rangedBonus : meleeBonus;
          const magicBonus = parseInt(w.magicBonus) || (() => {
            const match = (w.name || '').match(/\+(\d+)/); return match ? parseInt(match[1]) : 0;
          })();
          const displayAtk = (totalAtkBonus + magicBonus) >= 0 ? `+${totalAtkBonus + magicBonus}` : `${totalAtkBonus + magicBonus}`;
          const displayDmg = (w.damageBase || '1d6') + (strMod >= 0 && !isRanged ? `+${strMod}` : (strMod < 0 && !isRanged ? `${strMod}` : '')) + (magicBonus > 0 ? `+${magicBonus}` : '');
          const critStr = w.critical || '20/x2';
          return `<option value="${wIdx}"
            data-name="${w.name}"
            data-range="${w.range || 'Corpo-a-corpo'}"
            data-atk="${totalAtkBonus}"
            data-damage="${w.damageBase || '1d6'}"
            data-strmod="${isRanged ? 0 : strMod}"
            data-magic="${magicBonus}"
            data-crit="${critStr}"
          >${w.name || 'Arma'} (${isRanged ? 'Distância' : 'C-a-C'} | Atk: ${displayAtk}, Dano: ${displayDmg}, Crit: ${critStr})</option>`;
        }).join('');
      }

      attackSelectionHtml = `
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <div style="flex:1.2;">
            <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Selecione a Arma</span>
            <select id="action-weapon-select" class="rpg-select" style="width:100%; height:28px; font-size:0.75rem; padding:2px;">
              ${weaponOptions}
            </select>
          </div>
          <div style="flex:1;">
            <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Alvo / Monstro</span>
            <select id="action-physical-target" class="rpg-select" style="width:100%; height:28px; font-size:0.75rem; padding:2px;" onchange="app.dmUpdateSelectedTarget(${cIdx}, this.value)">
              ${enemyOptions}
            </select>
          </div>
        </div>
      `;
    } else {
      let npcWeaponOptions = "";
      const currentAttacks = c.attacks || c.weapons || [];
      if (Array.isArray(currentAttacks) && currentAttacks.length > 0) {
        npcWeaponOptions = currentAttacks.map((w, wIdx) => {
          const totalAtk = ((w.atkBonus !== undefined ? parseInt(w.atkBonus) : parseInt(w.atk)) || 0) + (parseInt(w.magicBonus) || 0);
          const totalDmgBonus = (parseInt(w.dmgBonus) || 0) + (parseInt(w.magicBonus) || 0);
          const totalAtkStr = totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`;
          const totalDmgBonusStr = totalDmgBonus > 0 ? `+${totalDmgBonus}` : (totalDmgBonus < 0 ? `${totalDmgBonus}` : '');
          const critVal = w.critical || '20/x2';
          const effectStr = w.effect ? `, ${w.effect}` : '';
          const disp = `${w.name} (${totalAtkStr} | ${w.diceCount}d${w.diceSize}${totalDmgBonusStr}, Crit: ${critVal}${effectStr})`;
          
          return `<option value="${wIdx}"
            data-atk="${totalAtk}"
            data-damage="${w.diceCount}d${w.diceSize}${totalDmgBonusStr}"
            data-crit="${critVal}"
          >${disp}</option>`;
        }).join('');
      } else if (typeof currentAttacks === 'string' && currentAttacks.trim()) {
        const splitWeaps = currentAttacks.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        npcWeaponOptions = splitWeaps.map((w, wIdx) => {
          const parsed = this.parseOldWeaponString(w);
          if (parsed) {
            const totalAtk = parsed.atkBonus + parsed.magicBonus;
            const totalDmgBonus = parsed.dmgBonus + parsed.magicBonus;
            const totalAtkStr = totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`;
            const totalDmgBonusStr = totalDmgBonus > 0 ? `+${totalDmgBonus}` : (totalDmgBonus < 0 ? `${totalDmgBonus}` : '');
            const critVal = parsed.critical || '20/x2';
            const effectStr = parsed.effect ? `, ${parsed.effect}` : '';
            return `<option value="${wIdx}"
              data-atk="${totalAtk}"
              data-damage="${parsed.diceCount}d${parsed.diceSize}${totalDmgBonusStr}"
              data-crit="${critVal}"
            >${parsed.name} (${totalAtkStr} | ${parsed.diceCount}d${parsed.diceSize}${totalDmgBonusStr}, Crit: ${critVal}${effectStr})</option>`;
          }
          return `<option value="${wIdx}" data-atk="0" data-damage="1d6" data-crit="20/x2">${w}</option>`;
        }).join('');
      } else {
        npcWeaponOptions = `<option value="default" data-atk="${parseInt(c.initMod)||0}" data-damage="1d6" data-crit="20/x2">Ataque Padrão (+${parseInt(c.initMod)||0} | 1d6, Crit: 20/x2)</option>`;
      }

      attackSelectionHtml = `
        <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:4px; margin-bottom:12px;">
          <!-- Linha 1: Selecionar arma / Alvo -->
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <div style="flex:1.2;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Arma</span>
              <select class="rpg-select" style="width:100%; height:28px; font-size:0.75rem; padding:2px;" onchange="app.dmSelectNpcWeapon(this)">
                <option value="">-- Personalizado / Manual --</option>
                ${npcWeaponOptions}
              </select>
            </div>
            <div style="flex:1;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Alvo / Jogador</span>
              <select id="action-physical-target" class="rpg-select" style="width:100%; height:28px; font-size:0.75rem; padding:2px;" onchange="app.dmUpdateSelectedTarget(${cIdx}, this.value)">
                ${enemyOptions}
              </select>
            </div>
          </div>

          <!-- Linha 2: BBA / Dado / Bônus / Decisivo -->
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <div style="flex:1;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">BBA</span>
              <input type="number" id="action-npc-atk-bonus" class="rpg-input" value="${parseInt(c.initMod) || 0}" style="width:100%; text-align:center; height:28px; padding:2px;">
            </div>
            <div style="flex:1.5;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Dado</span>
              <input type="text" id="action-npc-dmg-dice" class="rpg-input" value="1d6" placeholder="ex: 1d8" style="width:100%; height:28px; padding:2px; text-align:center;">
            </div>
            <div style="flex:1;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Bônus</span>
              <input type="number" id="action-npc-dmg-bonus" class="rpg-input" value="0" style="width:100%; text-align:center; height:28px; padding:2px;">
            </div>
            <div style="flex:1;">
              <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Decisivo</span>
              <input type="text" id="action-npc-crit" class="rpg-input" value="20/x2" placeholder="ex: 19-20/x2" style="width:100%; text-align:center; height:28px; padding:2px;">
            </div>
          </div>
          <em style="font-size:0.65rem; color:var(--text-muted); display:block; margin-top:4px;">Ataques oficiais: ${this.formatWeaponsText(c.weapons || c.attacks)}</em>
        </div>
      `;
    }

    let spellsToRender = []; // Array de { key: string, name: string, level: number }

    if (c.type === 'player') {
      const charObj = this.savedCharacters.find(ch => ch.id === c.charId);
      if (charObj && charObj.spellsKnown) {
        charObj.spellsKnown.forEach(spellKey => {
          const sp = window.DND3_SpellDatabase[spellKey];
          if (sp) {
            spellsToRender.push({
              key: spellKey,
              name: sp.name,
              level: sp.level || 0
            });
          }
        });
      }
    } else if (c.type === 'npc') {
      // NPC spells podem ser array ou string separada por vírgula
      let npcSpells = [];
      if (Array.isArray(c.spells)) {
        npcSpells = c.spells;
      } else if (typeof c.spells === 'string' && c.spells.trim()) {
        npcSpells = c.spells.split(',').map(s => s.trim()).filter(Boolean);
      }
      
      npcSpells.forEach(spellStr => {
        // Tenta achar equivalência na base de magias pelo nome (case-insensitive)
        let foundKey = Object.keys(window.DND3_SpellDatabase).find(k => {
          const sp = window.DND3_SpellDatabase[k];
          return sp.name.toLowerCase() === spellStr.toLowerCase() ||
                 (sp.nameEn && sp.nameEn.toLowerCase() === spellStr.toLowerCase()) ||
                 spellStr.toLowerCase().includes(sp.name.toLowerCase());
        });
        
        if (foundKey) {
          const sp = window.DND3_SpellDatabase[foundKey];
          spellsToRender.push({
            key: foundKey,
            name: sp.name,
            level: sp.level || 0
          });
        } else {
          // Se não estiver na base, adiciona como magia customizada
          const cleanName = spellStr.replace(/\(.*?\)/g, '').trim();
          spellsToRender.push({
            key: `custom_${spellStr}`,
            name: cleanName,
            level: 0
          });
        }
      });
    }

    const spellOptions = spellsToRender.map(sp => 
      `<option value="${sp.key}">${sp.name} (Nível ${sp.level})</option>`
    ).join('') || '<option value="">-- Nenhuma magia cadastrada --</option>';

    const logsHtml = this.dmActionLogs.map(log => {
      let logClass = '';
      if (log.type === 'heal') logClass = 'heal';
      if (log.type === 'damage') logClass = 'damage';
      if (log.type === 'buff') logClass = 'buff';
      return `<div class="roll-log-entry ${logClass}">${log.text}</div>`;
    }).reverse().join('');

    const levelVal = c.level || c.baseHD || 1;
    const max = c.actionsMax || this.getCombatantMaxActions(c) || 1;
    const used = c.actionsUsed || 0;

    const usedSlots = c.usedActionSlots || [];

    const modalBody = document.getElementById('modal-body-content');
    modalBody.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--accent-gold); padding-bottom:8px; margin-bottom:12px;">
        <h3 style="margin:0; font-family:var(--font-header); color:var(--accent-gold);">⚔️ Ações de Batalha: ${c.name} (Nível ${levelVal})</h3>
        <span style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
          Init: ${c.initRoll || '—'} | CA: ${c.ac} | HP: ${c.currentHp}/${c.maxHp} | 
          ${(() => {
            let dots = '';
            for (let i = 0; i < max; i++) {
              dots += usedSlots.includes(i) ? '🔴' : '🟢';
            }
            return dots;
          })()}
        </span>
      </div>

      <div class="action-modal-layout">
        <div class="action-modal-left">
          <div class="action-tabs">
            <button class="action-tab-btn active" onclick="app.dmSelectActionTab('physical', this)">⚔️ Físico</button>
            <button class="action-tab-btn" onclick="app.dmSelectActionTab('spells', this)">🔮 Magia</button>
            <button class="action-tab-btn" onclick="app.dmSelectActionTab('buffs', this)">✨ Buffs</button>
            <button class="action-tab-btn" onclick="app.dmSelectActionTab('debuffs', this)">💀 Debuffs</button>
          </div>

          <!-- Aba 1: Físico -->
          <div id="pane-physical" class="action-pane active">
            ${attackSelectionHtml}

            <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:4px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:bold; color:var(--accent-gold);">Modo de Ataque:</span>
                <select id="action-physical-mode" class="rpg-select" style="height:24px; padding:0 6px; font-size:0.75rem;" onchange="document.getElementById('manual-phys-inputs').style.display = this.value === 'manual' ? 'block' : 'none'">
                  <option value="auto">Automático (Rolar Sistema)</option>
                  <option value="manual">Manual (Dado Físico)</option>
                </select>
              </div>

              <div id="manual-phys-inputs" style="display:none; border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <label style="font-size:0.75rem; flex:1;">
                    <input type="checkbox" id="action-manual-hit-check" checked> Acertou?
                  </label>
                  <div style="flex:2; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:0.75rem; white-space:nowrap;">Dano Total:</span>
                    <input type="number" id="action-manual-dmg-input" class="rpg-input" placeholder="Qtd" style="width:60px; height:24px; text-align:center;">
                  </div>
                </div>
              </div>
            </div>

            ${(() => {
              const max = c.actionsMax || this.getCombatantMaxActions(c) || 1;
              const usedSlots = c.usedActionSlots || [];
              let buttonsHtml = '';
              for (let i = 0; i < max; i++) {
                const penalty = i * 5;
                const isUsed = usedSlots.includes(i);
                const disabledAttr = (isUsed || noActionsLeft) ? 'disabled' : '';
                const penaltyText = penalty > 0 ? ` (BBA -${penalty})` : ' (BBA Cheio)';
                const statusText = isUsed ? '✅ Já Usado' : '⚔️ Atacar!';
                
                buttonsHtml += `
                  <button class="rpg-btn" style="width:100%; margin-top:8px; background:linear-gradient(135deg, ${isUsed ? '#555' : 'var(--accent-red)'}, ${isUsed ? '#222' : '#5a0000'}); border-color:${isUsed ? '#666' : 'var(--accent-red)'}; font-size: 0.8rem; height: 32px;" 
                    onclick="app.dmExecutePhysicalAttack(${cIdx}, ${penalty}, ${i})" ${disabledAttr}>
                    Ação ${i + 1}: ${statusText}${penaltyText}
                  </button>
                `;
              }
              return buttonsHtml;
            })()}
          </div>

          <!-- Aba 2: Magia -->
          <div id="pane-spells" class="action-pane">
            <div class="rpg-form-group" style="margin-bottom:8px;">
              <label class="rpg-label">Selecione a Magia:</label>
              <select id="action-spell-select" class="rpg-select" style="width:100%;" onchange="app.dmOnSelectSpellInModal(this.value, ${cIdx})">
                <option value="">-- Selecione uma magia --</option>
                ${spellOptions}
              </select>
            </div>

            <div id="modal-spell-details" style="background:rgba(0,0,0,0.3); border:1px solid rgba(212,175,55,0.15); padding:8px; border-radius:4px; font-size:0.75rem; display:none; flex-direction:column; gap:4px; margin-bottom:8px;">
            </div>

            <button class="rpg-btn" style="width:100%; margin-top:4px; margin-bottom:8px; padding:8px 16px; font-size:0.88rem; font-weight:bold; white-space:nowrap; height:auto; min-height:36px; background:linear-gradient(135deg, #0284c7, #0369a1); border-color:#0284c7; display:none;" id="action-spell-btn" onclick="app.dmExecuteSpellcast(${cIdx})" ${noActionsLeft ? 'disabled title="Sem ações restantes neste turno"' : ''}>
              🔮 Conjurar Magia
            </button>

            <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:10px; border-radius:4px; display:none; flex-direction:column; gap:8px;" id="spell-roll-mode-container">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.8rem; font-weight:bold; color:var(--accent-gold);">Modo de Magia:</span>
                <select id="action-spell-mode" class="rpg-select" style="height:24px; padding:0 6px; font-size:0.75rem;" onchange="document.getElementById('manual-spell-inputs').style.display = this.value === 'manual' ? 'block' : 'none'">
                  <option value="auto">Automático (Rolar Sistema)</option>
                  <option value="manual">Manual (Digitar Dano/Cura)</option>
                </select>
              </div>

              <div id="manual-spell-inputs" style="display:none; border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                  <span style="font-size:0.75rem; white-space:nowrap;">Valor Total (Dano ou Cura):</span>
                  <input type="number" id="action-manual-spell-val" class="rpg-input" placeholder="ex: 12" style="width:70px; height:24px; text-align:center;">
                </div>
              </div>
            </div>
          </div>

          <!-- Aba 3: Buffs/Suporte -->
          <div id="pane-buffs" class="action-pane">
            <div class="rpg-form-group" style="margin-bottom:12px;">
              <label class="rpg-label">Selecione ou digite o Buff/Benefício:</label>
              <input type="text" id="action-buff-name-input" class="rpg-input" placeholder="Ex: Inspirar Coragem (+1)" style="width:100%; font-size:0.85rem;" list="suggested-buffs-list">
              <datalist id="suggested-buffs-list">
                <option value="Inspirar Coragem (+1 ataque/dano)">
                <option value="Bênção (+1 ataque/salvamentos)">
                <option value="Oração (+1 ataque/dano/salvamentos)">
                <option value="Escudo da Fé (+2 CA de deflexão)">
                <option value="Armadura Arcana (+4 CA de armadura)">
                <option value="Força do Touro (+4 força)">
              </datalist>
            </div>

            <div class="rpg-form-group" style="margin-bottom:12px;">
              <label class="rpg-label">Aplicar aos Combatentes:</label>
              <div class="targets-selection-list">
                ${buffCheckboxes}
              </div>
            </div>

            <button class="rpg-btn" style="width:100%; margin-top:8px; background:linear-gradient(135deg, #2ecc71, #27ae60); border-color:#2ecc71; font-size: 0.8rem; height: 32px;" onclick="app.dmExecuteBuff(${cIdx})" ${noActionsLeft ? 'disabled title="Sem ações restantes neste turno"' : ''}>
              ✨ Aplicar Buff
            </button>
          </div>

          <!-- Aba 4: Debuffs -->
          <div id="pane-debuffs" class="action-pane">
            <div class="rpg-form-group" style="margin-bottom:12px;">
              <label class="rpg-label">Selecione ou digite o Debuff / Condição Negativa:</label>
              <input type="text" id="action-debuff-name-input" class="rpg-input" placeholder="Ex: Atordoado" style="width:100%; font-size:0.85rem;" list="suggested-debuffs-list">
              <datalist id="suggested-debuffs-list">
                <option value="Atordoado">
                <option value="Caído">
                <option value="Cego">
                <option value="Envenenado">
                <option value="Silenciado">
                <option value="Apavorado">
                <option value="Imobilizado">
                <option value="Exausto">
                <option value="Lento">
                <option value="Surdo">
              </datalist>
            </div>

            <div class="rpg-form-group" style="margin-bottom:12px;">
              <label class="rpg-label">Aplicar aos Combatentes:</label>
              <div class="targets-selection-list">
                ${debuffCheckboxes}
              </div>
            </div>

            <button class="rpg-btn" style="width:100%; margin-top:8px; background:linear-gradient(135deg, #e11d48, #9f1239); border-color:#e11d48; font-size: 0.8rem; height: 32px;" onclick="app.dmExecuteDebuff(${cIdx})" ${noActionsLeft ? 'disabled title="Sem ações restantes neste turno"' : ''}>
              💀 Aplicar Debuff
            </button>
          </div>
        </div>

        <div class="action-modal-right" style="display:flex; flex-direction:column; gap:12px;">
          <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:10px;">
            <div class="roll-log-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:bold; font-size:0.85rem; color:var(--accent-gold);">Histórico</span>
              <button class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; height:22px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:#fff;" onclick="app.dmClearCombatRollLogs(${cIdx})">Limpar</button>
            </div>
            <div class="roll-log-container" id="modal-roll-log" style="max-height:140px; overflow-y:auto; font-size:0.75rem;">
              ${logsHtml || '<em style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding:15px 0; display:block;">Nenhuma ação rolada ainda.</em>'}
            </div>
          </div>

          <!-- Lista de Alvos (Abaixo do Histórico) -->
          <div class="rpg-form-group" id="spell-targets-group" style="display:none; flex-direction:column; gap:6px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:10px;">
            <label class="rpg-label" id="spell-targets-label" style="font-size:0.8rem; font-weight:bold; color:var(--accent-gold); margin:0;">Selecione o(s) Alvo(s):</label>
            <div class="targets-selection-list" id="spell-targets-list" style="max-height:150px; overflow-y:auto;">
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; border-top:1px solid rgba(170, 124, 17, 0.2); padding-top:8px; margin-top:12px;">
        <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Fechar</button>
      </div>
    `;

    this.showModal();
  }

  dmSelectActionTab(tabName, clickedBtn) {
    const paneIds = ['pane-physical', 'pane-spells', 'pane-buffs', 'pane-debuffs'];
    paneIds.forEach(id => {
      const pane = document.getElementById(id);
      if (pane) pane.classList.toggle('active', id === `pane-${tabName}`);
    });
    
    if (clickedBtn && clickedBtn.parentElement) {
      clickedBtn.parentElement.querySelectorAll('.action-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn === clickedBtn);
      });
    }
  }

  dmOnSelectSpellInModal(spellKey, cIdx) {
    let spell;
    if (spellKey && spellKey.startsWith('custom_')) {
      const spellName = spellKey.replace('custom_', '');
      spell = {
        name: spellName,
        school: "Personalizada",
        range: "Personalizado",
        damage: "Rolagem Manual",
        save: "Nenhum",
        desc: "Magia de criador de inimigos."
      };
    } else {
      spell = window.DND3_SpellDatabase[spellKey];
    }
    const detailsContainer = document.getElementById('modal-spell-details');
    const targetsGroup = document.getElementById('spell-targets-group');
    const targetsList = document.getElementById('spell-targets-list');
    const modeContainer = document.getElementById('spell-roll-mode-container');
    const spellBtn = document.getElementById('action-spell-btn');

    if (!spell) {
      if (detailsContainer) detailsContainer.style.display = 'none';
      if (targetsGroup) targetsGroup.style.display = 'none';
      if (modeContainer) modeContainer.style.display = 'none';
      if (spellBtn) spellBtn.style.display = 'none';
      return;
    }

    if (detailsContainer) {
      detailsContainer.style.display = 'flex';
      detailsContainer.innerHTML = `
        <div style="font-weight:bold; color:var(--accent-gold);">${spell.name}</div>
        <div><strong>Dano/Efeito:</strong> ${spell.damage || '--'} | <strong>Salvamento:</strong> ${spell.save || '--'}</div>
      `;
    }

    const c = this.dmCombatants[cIdx];
    const isHeal = (spell.school && spell.school.toLowerCase().includes('cura')) || (spell.damage && spell.damage.toLowerCase().includes('cura'));
    
    const targetsHTML = isHeal 
      ? this.dmCombatants.filter(x => x.type === c.type).map(a => {
          const originalIdx = this.dmCombatants.indexOf(a);
          return `<label style="display:inline-flex; align-items:center; gap:6px;"><input type="checkbox" name="spell-target" value="${originalIdx}"> ${this.getCombatantDisplayName(a)}</label>`;
        }).join('')
      : this.dmCombatants.filter(x => x.type !== c.type).map(e => {
          const originalIdx = this.dmCombatants.indexOf(e);
          return `<label style="display:inline-flex; align-items:center; gap:6px;"><input type="checkbox" name="spell-target" value="${originalIdx}"> ${this.getCombatantDisplayName(e)} (CA ${e.ac})</label>`;
        }).join('');

    if (targetsList) {
      targetsList.innerHTML = targetsHTML || '<em style="color:var(--text-muted); font-size:0.75rem;">Nenhum alvo válido ativo.</em>';
    }

    if (targetsGroup) targetsGroup.style.display = 'flex';
    if (modeContainer) modeContainer.style.display = 'flex';
    if (spellBtn) spellBtn.style.display = 'block';
  }

  dmUpdateSelectedTarget(cIdx, targetIdxVal) {
    const c = this.dmCombatants[cIdx];
    if (c) {
      c.targetKey = parseInt(targetIdxVal);
      this.saveCombatState();
    }
  }

  dmExecutePhysicalAttack(cIdx, penalty = 0, actionSlotIdx = 0) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const targetSelect = document.getElementById('action-physical-target');
    const targetIdx = targetSelect ? parseInt(targetSelect.value) : (c.targetKey !== undefined ? parseInt(c.targetKey) : NaN);
    const target = this.dmCombatants[targetIdx];

    if (isNaN(targetIdx) || !target) {
      alert('Por favor, selecione um alvo válido!'); return;
    }

    if (targetSelect && !isNaN(targetIdx)) {
      c.targetKey = targetIdx;
    }

    const mode = document.getElementById('action-physical-mode').value;
    let logText = '';
    let isHit = false;
    let rolledDmg = 0;

    if (mode === 'auto') {
      let atkBonus = 0;
      let weaponName = 'Ataque Físico';
      let dmgDice = '1d6';
      let strModForDmg = 0;
      let magicBonus = 0;
      let critRange = 20;  // threat range floor (e.g. 19 means 19-20)
      let critMult = 2;    // damage multiplier on confirmed crit
      let isRangedWeapon = false;

      if (c.type === 'player') {
        const charObj = this.savedCharacters.find(ch => ch.id === c.charId);
        const weaponSelect = document.getElementById('action-weapon-select');
        const opt = weaponSelect.options[weaponSelect.selectedIndex];

        weaponName   = opt.getAttribute('data-name')   || 'Ataque';
        atkBonus     = parseInt(opt.getAttribute('data-atk'))   || 0;
        dmgDice      = opt.getAttribute('data-damage') || '1d6';
        strModForDmg = parseInt(opt.getAttribute('data-strmod')) || 0;
        magicBonus   = parseInt(opt.getAttribute('data-magic'))  || 0;
        isRangedWeapon = (opt.getAttribute('data-range') || 'Corpo-a-corpo') !== 'Corpo-a-corpo';

        // Parse critical threat range and multiplier from e.g. "19-20/x2" or "20/x3"
        const critStr = opt.getAttribute('data-crit') || '20/x2';
        const critMatch = critStr.match(/(\d+)(?:-\d+)?\/x(\d+)/);
        if (critMatch) {
          critRange = parseInt(critMatch[1]);
          critMult  = parseInt(critMatch[2]);
        }

        // Apply Inspire Courage buff to attack and damage
        if (c.buffs && c.buffs.some(b => b.toLowerCase().includes('inspirar coragem'))) {
          atkBonus   += 1;
          magicBonus += 1; // treated as flat bonus to dmg
        }
      } else {
        // NPC / Monster
        atkBonus   = parseInt(document.getElementById('action-npc-atk-bonus').value) || 0;
        const npcDmgDice = document.getElementById('action-npc-dmg-dice').value || '1d6';
        const npcDmgBonus = parseInt(document.getElementById('action-npc-dmg-bonus').value) || 0;
        const npcDmgRaw = npcDmgBonus !== 0 
          ? `${npcDmgDice}${npcDmgBonus >= 0 ? '+' : ''}${npcDmgBonus}` 
          : npcDmgDice;
        dmgDice      = npcDmgRaw;
        strModForDmg = 0; // already baked into expression
        magicBonus   = 0;

        const npcCritVal = document.getElementById('action-npc-crit') ? document.getElementById('action-npc-crit').value : '20/x2';
        const parsedCrit = this.parseCritString(npcCritVal);
        critRange = parsedCrit.range;
        critMult  = parsedCrit.mult;
      }

      atkBonus -= penalty;
      if (penalty > 0) {
        logText += `<span style="font-size:0.75rem; color:var(--text-muted);">[Ação Múltipla: Penalidade de -${penalty} no ataque]</span><br>`;
      }

      // --- STEP 1: Attack Roll ---
      const rollAtk = Math.floor(Math.random() * 20) + 1;
      const isCritThreat = rollAtk >= critRange;
      const isCritFail   = rollAtk === 1;
      const totalAtk     = rollAtk + atkBonus + magicBonus;

      // Determine hit
      let critConfirmed = false;
      if (!isCritFail && totalAtk >= target.ac) {
        isHit = true;
        if (isCritThreat) {
          // Roll confirmation
          const confirmRoll = Math.floor(Math.random() * 20) + 1;
          const confirmTotal = confirmRoll + atkBonus + magicBonus;
          critConfirmed = confirmTotal >= target.ac;
          logText += `<em style="color:#eab308;">Ameaça Crítica! Confirmação: d20(${confirmRoll})+${atkBonus+magicBonus}=${confirmTotal} vs CA ${target.ac} → ${critConfirmed ? '<strong style="color:#f59e0b;">CRÍTICO CONFIRMADO!</strong>' : 'não confirmado'}</em><br>`;
        }
      } else if (!isCritFail && isCritThreat) {
        // Threat but missed normally — still confirm
        const confirmRoll = Math.floor(Math.random() * 20) + 1;
        const confirmTotal = confirmRoll + atkBonus + magicBonus;
        if (confirmTotal >= target.ac) {
          isHit = true;
          critConfirmed = true;
          logText += `<em style="color:#eab308;">Ameaça Crítica! Confirmação: d20(${confirmRoll})+${atkBonus+magicBonus}=${confirmTotal} vs CA ${target.ac} → <strong style="color:#f59e0b;">CRÍTICO CONFIRMADO!</strong></em><br>`;
        }
      }

      // Format attack roll display
      let atkLabel = `d20(${rollAtk}) + ${atkBonus + magicBonus} = <span class="dice-result-val${isCritFail ? ' crit-fail' : isCritThreat ? ' crit-success' : ''}">${totalAtk}</span>`;

      logText = `<strong>${c.name}</strong> ${isRangedWeapon ? 'arremessou' : 'atacou'} <strong>${target.name}</strong> com <em>${weaponName}</em>:<br>`
              + logText
              + `Ataque (${isRangedWeapon ? 'BBA+Des' : 'BBA+For'}): ${atkLabel} vs CA ${target.ac} → `;

      if (isCritFail) {
        logText += `<span style="color:#e74c3c;">FALHA CRÍTICA — Erra automaticamente!</span>`;
      } else if (isHit) {
        logText += `<span style="color:#2ecc71; font-weight:bold;">ACERTOU</span>)<br>`;

        // --- STEP 2: Damage Roll ---
        const diceResult = this.rollDiceExpression(dmgDice);
        let baseDmg = diceResult.total;
        const fixedBonus = strModForDmg + magicBonus; // not multiplied on crit

        if (critConfirmed) {
          // Roll extra damage dice (critMult - 1) additional times; bonuses add once
          let extraDice = 0;
          let extraBreakdown = [];
          for (let m = 1; m < critMult; m++) {
            const extra = this.rollDiceExpression(dmgDice);
            extraDice += extra.total;
            extraBreakdown.push(extra.breakdown.split('=')[0].trim());
          }
          rolledDmg = baseDmg + extraDice + fixedBonus;
          logText += `Dano (CRÍTICO ×${critMult}): (${diceResult.breakdown.split('=')[0].trim()}) `
                   + (extraBreakdown.length ? `+ ${extraBreakdown.join(' + ')} ` : '')
                   + `+ ${fixedBonus} (Força/mágico) = <span style="color:#f59e0b; font-weight:bold;">[${rolledDmg} HP]</span>`;
        } else {
          rolledDmg = baseDmg + fixedBonus;
          logText += `Dano: ${diceResult.breakdown} + ${fixedBonus} (Força/mágico) = <span style="color:#e74c3c; font-weight:bold;">[${rolledDmg} HP]</span>`;
        }
      } else {
        logText += `<span style="color:#e74c3c; font-weight:bold;">ERROU</span>)`;
      }
    } else {
      // Manual mode
      isHit     = document.getElementById('action-manual-hit-check').checked;
      rolledDmg = parseInt(document.getElementById('action-manual-dmg-input').value) || 0;
      logText = `<strong>${c.name}</strong> realizou ataque físico <strong>manual</strong> contra <strong>${target.name}</strong>: `;
      logText += isHit
        ? `<span style="color:#2ecc71; font-weight:bold;">ACERTOU</span>, causando <span style="color:#e74c3c; font-weight:bold;">${rolledDmg} HP</span> de dano.`
        : `<span style="color:#e74c3c; font-weight:bold;">ERROU</span>.`;
    }

    // Apply damage
    if (isHit && rolledDmg > 0) {
      const wasAlreadyDefeated = target.currentHp <= 0;
      let nextHp = Math.max(-10, target.currentHp - rolledDmg);
      target.currentHp = nextHp;
      if (nextHp <= 0 && !wasAlreadyDefeated) {
        const charName = target.name || 'Alvo';
        this.lastDefeatedEvent = { charName: charName, time: Date.now() };
        this.triggerDefeatedAnimation(charName);
      }
      if (target.type === 'player' && target.charId) {
        const char = this.savedCharacters.find(ch => ch.id === target.charId);
        if (char) { char.currentHp = nextHp; this.saveCharactersState(); }
      }
      if (c.type === 'player') {
        if (!target.damageByPlayer) target.damageByPlayer = {};
        target.damageByPlayer[c.name] = (target.damageByPlayer[c.name] || 0) + rolledDmg;
      }
    }

    this.saveCombatState();
    if (!this.dmActionLogs) this.dmActionLogs = [];
    this.dmActionLogs.push({ type: isHit ? 'damage' : 'general', text: logText });
    this.dmRefreshModalRollLog();
    
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }

    // Marcar o slot de ação usado e verificar ações do combatente
    this.dmIncrementCombatantActions(cIdx, actionSlotIdx);
    this.dmCombatantActionsModal(cIdx);
  }

  dmExecuteSpellcast(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const spellKey = document.getElementById('action-spell-select').value;
    let spell;
    if (spellKey && spellKey.startsWith('custom_')) {
      const spellName = spellKey.replace('custom_', '');
      spell = {
        name: spellName,
        school: "Personalizada",
        range: "Personalizado",
        damage: "Rolagem Manual",
        save: "Nenhum",
        desc: "Magia de criador de inimigos."
      };
    } else {
      spell = window.DND3_SpellDatabase[spellKey];
    }
    if (!spell) { alert('Por favor, selecione uma magia!'); return; }

    const targetCheckboxes = document.querySelectorAll('input[name="spell-target"]:checked');
    const targetIdxs = Array.from(targetCheckboxes).map(chk => parseInt(chk.value));
    if (targetIdxs.length === 0) { alert('Por favor, selecione pelo menos um alvo!'); return; }

    const mode = document.getElementById('action-spell-mode').value;
    const isHeal = (spell.school && spell.school.toLowerCase().includes('cura')) || (spell.damage && spell.damage.toLowerCase().includes('cura'));
    const hasSR = spell.spellRes && spell.spellRes.toLowerCase().includes('sim');

    // Determine caster level
    let casterLevel = 1;
    if (c.type === 'player') {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) casterLevel = parseInt(char.level) || 1;
    } else {
      casterLevel = Math.max(1, Math.round(c.maxHp / 8));
    }

    let logText = `<strong>${c.name}</strong> conjurou <strong>${spell.name}</strong> (Nv.${casterLevel}):<br>`;

    // Determine damage expression
    let dmgExpr = '1d6';
    let isFixed = false;
    let fixedVal = 0;
    const rawDamage = (spell.damage || '').toLowerCase().trim();
    const cleanDamage = rawDamage.replace(/\s+/g, '');

    if (cleanDamage === 'cura1pv' || cleanDamage === '1pv' || cleanDamage === '1dano') {
      isFixed = true; 
      fixedVal = 1;
    } else if (rawDamage.includes('por nível') || rawDamage.includes('por nivel')) {
      // Formatos: "1d6 por nível de conjurador (máx 10d6)" ou "1d6 por nível (máx 15d6)" ou "10 pv por nível (máx 150)"
      const diceMatch = rawDamage.match(/(\d*)d(\d+)/i);
      if (diceMatch) {
        const numDice = parseInt(diceMatch[1]) || 1;
        const dieSize = parseInt(diceMatch[2]);
        let totalDice = numDice * casterLevel;
        
        // Achar limite de dados (máx 10d6)
        const maxDiceMatch = rawDamage.match(/m(?:á|a)x\s*(\d+)d/i);
        if (maxDiceMatch) {
          const maxDice = parseInt(maxDiceMatch[1]);
          totalDice = Math.min(totalDice, maxDice);
        }
        dmgExpr = `${totalDice}d${dieSize}`;
      } else {
        // Valores fixos por nível como "10 pv por nível (máx 150)"
        const pvMatch = rawDamage.match(/(\d+)\s*(?:pv|dano)\s*por/i);
        if (pvMatch) {
          isFixed = true;
          let val = parseInt(pvMatch[1]) * casterLevel;
          const maxPvMatch = rawDamage.match(/m(?:á|a)x\s*(\d+)/i);
          if (maxPvMatch) {
            val = Math.min(val, parseInt(maxPvMatch[1]));
          }
          fixedVal = val;
        }
      }
    } else {
      const m = cleanDamage.match(/(\d*d\d+)/i);
      if (m) dmgExpr = m[1];
      if (cleanDamage.includes('+cl') || cleanDamage.includes('+1/n')) {
        const maxMatch = cleanDamage.match(/m(?:á|a)x\+?(\d+)/i);
        const bonus = maxMatch ? Math.min(casterLevel, parseInt(maxMatch[1])) : casterLevel;
        dmgExpr += `+${bonus}`;
      }
    }

    // Saving throw info
    let saveTypeKey = 'ref'; let saveTypeName = 'Reflexos';
    if (spell.save && spell.save.toLowerCase().includes('fort')) { saveTypeKey = 'fort'; saveTypeName = 'Fortitude'; }
    else if (spell.save && spell.save.toLowerCase().includes('von')) { saveTypeKey = 'will'; saveTypeName = 'Vontade'; }
    const noSave = !spell.save || spell.save.toLowerCase().includes('nenhum') || spell.save === '--';

    // Caster ability mod for save DC
    let castingMod = 0;
    if (c.type === 'player') {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) {
        const stats = this.calculateActiveStats(char);
        const attrKey = ['cleric','druid','paladin','ranger'].includes(char.class) ? 'wis' : ['sorcerer','bard'].includes(char.class) ? 'cha' : 'int';
        castingMod = (stats.mods && stats.mods[attrKey]) || 0;
      }
    } else {
      const attr = c.attributes || {};
      castingMod = Math.floor((Math.max(attr.int||10, attr.wis||10, attr.cha||10) - 10) / 2);
    }
    const saveDC = 10 + (parseInt(spell.level) || 0) + castingMod;

    if (!noSave && !isHeal) {
      logText += `CD do Salvamento de ${saveTypeName}: <strong>${saveDC}</strong><br>`;
    }

    // Roll damage / heal once (shared across all targets)
    let totalEffect = 0;
    if (mode === 'auto') {
      if (isFixed) { totalEffect = fixedVal; }
      else {
        const rollResult = this.rollDiceExpression(dmgExpr);
        totalEffect = rollResult.total;
        logText += `Rolagem do efeito: ${rollResult.breakdown}<br>`;
      }
    } else {
      totalEffect = parseInt(document.getElementById('action-manual-spell-val').value) || 0;
      logText += `Efeito manual: <strong>${totalEffect}</strong><br>`;
    }

    // Process each target
    targetIdxs.forEach(tIdx => {
      const t = this.dmCombatants[tIdx];
      if (!t) return;

      let targetLog = `• <strong>${t.name}</strong>: `;

      // ——— SPELL RESISTANCE CHECK ———
      if (!isHeal && hasSR && (t.sr || 0) > 0) {
        const srRoll = Math.floor(Math.random() * 20) + 1;
        const srTotal = srRoll + casterLevel;
        const srPassed = srTotal >= t.sr;
        targetLog += `Teste RM: d20(${srRoll})+${casterLevel}=${srTotal} vs RM ${t.sr} → `;
        if (!srPassed) {
          targetLog += `<span style="color:#e74c3c; font-weight:bold;">MAGIA ANULADA pela RM!</span>`;
          logText += targetLog + '<br>';
          return;
        }
        targetLog += `<span style="color:#2ecc71;">Penetrou a RM.</span> `;
      }

      // ——— HEALING ———
      if (isHeal) {
        let nextHp = Math.min(t.maxHp, t.currentHp + totalEffect);
        t.currentHp = nextHp;
        if (t.type === 'player' && t.charId) {
          const char = this.savedCharacters.find(ch => ch.id === t.charId);
          if (char) { char.currentHp = nextHp; this.saveCharactersState(); }
        }
        targetLog += `Restaurou <span style="color:#2ecc71; font-weight:bold;">+${totalEffect} PV</span>.`;
        logText += targetLog + '<br>';
        return;
      }

      // ——— SAVING THROW ———
      let dmgToApply = totalEffect;
      if (!noSave && mode === 'auto') {
        const saveMod = this.dmGetCombatantSaveModifier(t, saveTypeKey);
        const saveRoll = Math.floor(Math.random() * 20) + 1;
        const saveTotal = saveRoll + saveMod;
        const savedSuccess = saveTotal >= saveDC;
        if (savedSuccess) {
          dmgToApply = Math.floor(totalEffect / 2);
          targetLog += `Salvamento ${saveTypeName}: d20(${saveRoll})+${saveMod}=${saveTotal} → <span style="color:#2ecc71;">PASSOU</span>. Dano ½: <span style="color:#e74c3c; font-weight:bold;">${dmgToApply} HP</span>. `;
        } else {
          targetLog += `Salvamento ${saveTypeName}: d20(${saveRoll})+${saveMod}=${saveTotal} → <span style="color:#e74c3c;">FALHOU</span>. Dano total: <span style="color:#e74c3c; font-weight:bold;">${dmgToApply} HP</span>. `;
        }
      } else {
        targetLog += `Dano: <span style="color:#e74c3c; font-weight:bold;">${dmgToApply} HP</span>. `;
      }

      // Apply damage
      const wasAlreadyDefeated = t.currentHp <= 0;
      let nextHp = Math.max(-10, t.currentHp - dmgToApply);
      t.currentHp = nextHp;
      if (nextHp <= 0 && !wasAlreadyDefeated) {
        const charName = t.name || 'Alvo';
        this.lastDefeatedEvent = { charName: charName, time: Date.now() };
        this.triggerDefeatedAnimation(charName);
      }
      if (t.type === 'player' && t.charId) {
        const char = this.savedCharacters.find(ch => ch.id === t.charId);
        if (char) { char.currentHp = nextHp; this.saveCharactersState(); }
      }
      if (c.type === 'player' && t.type === 'npc') {
        if (!t.damageByPlayer) t.damageByPlayer = {};
        t.damageByPlayer[c.name] = (t.damageByPlayer[c.name] || 0) + dmgToApply;
      }

      logText += targetLog + '<br>';
    });

    // Consume spell slot for players
    if (c.type === 'player' && spell.level > 0) {
      const char = this.savedCharacters.find(ch => ch.id === c.charId);
      if (char) {
        if (!char.spellSlots) char.spellSlots = {};
        const levelKey = `lvl_${spell.level}`;
        const cur = char.spellSlots[levelKey] !== undefined ? parseInt(char.spellSlots[levelKey]) : 0;
        if (cur > 0) {
          char.spellSlots[levelKey] = cur - 1;
          this.saveCharactersState();
          logText += `<em style="color:var(--text-muted); font-size:0.7rem;">Slot Nv.${spell.level} consumido (Restantes: ${cur - 1})</em>`;
        } else {
          logText += `<em style="color:#e74c3c; font-size:0.7rem;">[Aviso] Sem slots Nv.${spell.level} disponíveis!</em>`;
        }
      }
    }

    this.saveCombatState();
    if (!this.dmActionLogs) this.dmActionLogs = [];
    this.dmActionLogs.push({ type: isHeal ? 'heal' : 'damage', text: logText });
    this.dmRefreshModalRollLog();
    
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }

    // Incrementar e verificar ações do combatente
    this.dmIncrementCombatantActions(cIdx);
  }


  dmExecuteBuff(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const inputVal = document.getElementById('action-buff-name-input').value.trim();
    if (!inputVal) {
      alert("Por favor, digite ou selecione um Buff!");
      return;
    }

    const targetCheckboxes = document.querySelectorAll('input[name="buff-target"]:checked');
    const targetIdxs = Array.from(targetCheckboxes).map(chk => parseInt(chk.value));

    if (targetIdxs.length === 0) {
      alert("Por favor, selecione pelo menos um combatente para receber o buff!");
      return;
    }

    let logText = `<strong>${c.name}</strong> ativou o buff/benefício <strong>${inputVal}</strong>:<br>`;

    targetIdxs.forEach(tIdx => {
      const t = this.dmCombatants[tIdx];
      if (!t) return;

      if (!t.buffs) t.buffs = [];
      if (!t.buffs.includes(inputVal)) {
        t.buffs.push(inputVal);
      }

      logText += `• Aplicado em <strong>${t.name}</strong>.<br>`;
    });

    this.saveCombatState();
    if (!this.dmActionLogs) this.dmActionLogs = [];
    this.dmActionLogs.push({
      type: 'buff',
      text: logText
    });

    this.dmRefreshModalRollLog();
    
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }

    // Incrementar e verificar ações do combatente
    this.dmIncrementCombatantActions(cIdx);
  }

  dmExecuteDebuff(cIdx) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    const inputVal = document.getElementById('action-debuff-name-input').value.trim();
    if (!inputVal) {
      alert("Por favor, digite ou selecione um Debuff / Condição!");
      return;
    }

    const targetCheckboxes = document.querySelectorAll('input[name="debuff-target"]:checked');
    const targetIdxs = Array.from(targetCheckboxes).map(chk => parseInt(chk.value));

    if (targetIdxs.length === 0) {
      alert("Por favor, selecione pelo menos um combatente para receber o debuff!");
      return;
    }

    let logText = `<strong>${c.name}</strong> aplicou a condição/debuff <strong>${inputVal}</strong>:<br>`;

    targetIdxs.forEach(tIdx => {
      const t = this.dmCombatants[tIdx];
      if (!t) return;

      if (!t.conditions) t.conditions = [];
      if (!t.conditions.includes(inputVal)) {
        t.conditions.push(inputVal);
      }

      logText += `• Aplicado em <strong>${t.name}</strong>.<br>`;
    });

    this.saveCombatState();
    if (!this.dmActionLogs) this.dmActionLogs = [];
    this.dmActionLogs.push({
      type: 'damage',
      text: logText
    });

    this.dmRefreshModalRollLog();
    
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }

    this.dmIncrementCombatantActions(cIdx);
  }

  dmRefreshModalRollLog() {
    const container = document.getElementById('modal-roll-log');
    if (!container) return;

    const logsHtml = this.dmActionLogs.map(log => {
      let logClass = '';
      if (log.type === 'heal') logClass = 'heal';
      if (log.type === 'damage') logClass = 'damage';
      if (log.type === 'buff') logClass = 'buff';
      return `<div class="roll-log-entry ${logClass}">${log.text}</div>`;
    }).reverse().join('');

    container.innerHTML = logsHtml || '<em style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding-top:20px;">Nenhuma ação rolada ainda.</em>';
  }

  dmClearCombatRollLogs(cIdx) {
    this.dmActionLogs = [];
    this.dmRefreshModalRollLog();
  }

  // TAB 4: RULE COMPENDIUM
  setCompendiumSubtab(sub) {
    this.compendiumSubtab = sub;
    
    // Toggle active buttons
    document.querySelectorAll('#tab-rules .nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    document.getElementById(`comp-btn-${sub}`).classList.add('active');
    this.renderCompendium();
  }

  searchRules() {
    const val = document.getElementById('rules-search-input').value.toLowerCase();
    this.rulesSearchQuery = val;
    this.renderCompendium();
  }

  renderCompendium() {
    const viewport = document.getElementById('compendium-viewport');
    if (!viewport) return;

    let html = "";
    const q = this.rulesSearchQuery;

    if (this.compendiumSubtab === 'skills') {
      html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
      for (let k in window.DND3_Skills) {
        const sk = window.DND3_Skills[k];
        if (q && !sk.name.toLowerCase().includes(q) && !sk.desc.toLowerCase().includes(q)) {
          continue;
        }

        html += `
          <div class="rpg-card spell-card">
            <h4 style="font-size:1.1rem; color:var(--accent-gold);">${sk.name}</h4>
            <div style="font-size:0.75rem; color:var(--accent-gold-dark); margin-bottom:5px;">
              Atributo Chave: <strong>${sk.keyAbility.toUpperCase()}</strong> | 
              Exige Treinamento: <strong>${sk.trainedOnly ? 'Sim' : 'Não'}</strong> | 
              Penalidade de Armadura: <strong>${sk.armorPenalty ? 'Sim' : 'Não'}</strong>
            </div>
            <p style="font-size:0.85rem; color:var(--text-parchment);">${sk.desc}</p>
          </div>
        `;
      }
      html += `</div>`;
    } else if (this.compendiumSubtab === 'feats') {
      html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
      for (let k in window.DND3_Feats) {
        const ft = window.DND3_Feats[k];
        if (q && !ft.name.toLowerCase().includes(q) && !ft.benefit.toLowerCase().includes(q)) {
          continue;
        }

        let prereqParts = [];
        if (ft.prereqs.str) prereqParts.push(`FOR ${ft.prereqs.str}`);
        if (ft.prereqs.dex) prereqParts.push(`DES ${ft.prereqs.dex}`);
        if (ft.prereqs.bab) prereqParts.push(`BBA +${ft.prereqs.bab}`);
        if (ft.prereqs.class) prereqParts.push(`Classe: ${window.DND3_Classes[ft.prereqs.class].name}`);
        if (ft.prereqs.feats) {
          ft.prereqs.feats.forEach(fKey => prereqParts.push(`Talento: ${window.DND3_Feats[fKey].name}`));
        }
        let prereqsText = prereqParts.length > 0 ? prereqParts.join(', ') : "Nenhum";

        html += `
          <div class="rpg-card feat-card">
            <h4 style="font-size:1.15rem;">${ft.name}</h4>
            <div style="font-size:0.75rem; color:var(--accent-gold-dark); margin-bottom:5px;">
              Pré-requisitos: <strong>${prereqsText}</strong>
            </div>
            <p style="font-size:0.85rem; margin-bottom:5px;"><strong>Benefício:</strong> ${ft.benefit}</p>
            ${ft.description ? `<p style="font-size:0.75rem; font-style:italic; color:var(--text-muted);">${ft.description}</p>` : ''}
          </div>
        `;
      }
      html += `</div>`;
    } else if (this.compendiumSubtab === 'spells') {
      html += `
        <div style="margin-bottom:1.5rem;">
          <h3 style="font-size:1.1rem; margin-bottom:0.5rem; color:var(--accent-gold);">Grimório Geral de Magias (PHB 3.0 e Suplementos)</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
            Abaixo estão listadas todas as magias registradas no sistema. Use a barra de pesquisa acima para filtrar por nome ou descrição.
          </p>
          <div style="background:rgba(212,175,55,0.05); padding:10px; border-radius:4px; font-size:0.8rem; border-left:3px solid var(--accent-gold); margin-bottom: 15px;">
            <strong>Slots Extras por Atributo Elevado</strong>: Se a habilidade chave do conjurador for alta, ele ganha slots bônus. A regra de cálculo de slots de nível L segue a fórmula: <code>Math.ceil((Modificador - L + 1) / 4)</code>. Ex: Modificador +4 (Atributo 18) concede 1 slot extra para os níveis 1, 2, 3 e 4.
          </div>
        </div>
      `;

      // Group spells in window.DND3_SpellDatabase by level
      const spellsByLvl = {};
      for (let k in window.DND3_SpellDatabase) {
        const sp = window.DND3_SpellDatabase[k];
        if (q && !sp.name.toLowerCase().includes(q) && !sp.desc.toLowerCase().includes(q)) {
          continue;
        }
        if (!spellsByLvl[sp.level]) {
          spellsByLvl[sp.level] = [];
        }
        spellsByLvl[sp.level].push(sp);
      }

      let hasSpells = false;
      for (let lvl = 0; lvl <= 10; lvl++) {
        const list = spellsByLvl[lvl] || [];
        if (list.length === 0) continue;
        hasSpells = true;

        const levelLabel = lvl === 10 ? "Épico (Nível 10+)" : `Nível ${lvl}`;
        html += `<h3 style="font-size:1.1rem; margin-top:1.5rem; margin-bottom:10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; color:var(--accent-gold);">${levelLabel}</h3>`;
        html += `<div style="display:flex; flex-direction:column; gap:10px; margin-bottom: 20px;">`;
        
        list.forEach(sp => {
          const classNames = sp.classes.map(c => {
            const classMap = {
              'wizard': 'Mago',
              'cleric': 'Clérigo',
              'druid': 'Druida',
              'bard': 'Bardo',
              'sorcerer': 'Feiticeiro',
              'paladin': 'Paladino',
              'ranger': 'Ranger'
            };
            return classMap[c] || c;
          }).join(', ');

          html += `
            <div class="rpg-card spell-card" style="margin-bottom:8px; padding:10px 15px; border-left: 4px solid var(--accent-gold); background: rgba(0,0,0,0.25);">
              <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:5px; border-bottom: 1px solid rgba(212,175,55,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                <strong style="color:var(--text-light); font-size:0.95rem;">${sp.name}</strong>
                <span class="spell-school" style="font-size:0.75rem; color:var(--accent-gold-dark);">
                  ${sp.school} | Conjuradores: ${classNames}
                </span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted); display:grid; grid-template-columns: 1fr 1fr; gap:2px 10px;">
                <div><strong>Alcance:</strong> ${sp.range || '--'}</div>
                <div><strong>Duração:</strong> ${sp.duration || '--'}</div>
                <div><strong>Resistência:</strong> ${sp.save || '--'}</div>
                <div><strong>RM:</strong> ${sp.spellRes || '--'}</div>
                ${sp.damage && sp.damage !== '--' ? `<div style="grid-column: span 2;"><strong>Dano/Efeito:</strong> <span style="color:var(--accent-gold);">${sp.damage}</span></div>` : ''}
              </div>
              <div style="font-size:0.8rem; color:var(--text-parchment); margin-top:6px; line-height:1.4;">${sp.desc}</div>
              ${sp.check ? `<div style="font-size:0.7rem; color:#ff9999; margin-top:4px; font-style:italic;"><strong>Execução:</strong> ${sp.check}</div>` : ''}
            </div>
          `;
        });
        html += `</div>`;
      }

      if (!hasSpells) {
        html += `<div style="text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">Nenhuma magia encontrada para a busca "${q}".</div>`;
      }

    } else if (this.compendiumSubtab === 'equipment') {
      html += `
        <div class="grid-2">
          <!-- Weapon list -->
          <div>
            <h3 style="font-size:1.1rem; margin-bottom:10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:4px;">Armas Oficiais (Tamanho 3.0)</h3>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:400px; overflow-y:auto; padding-right:5px;">
      `;

      window.DND3_Equipment.weapons.forEach(w => {
        if (q && !w.name.toLowerCase().includes(q)) return;
        html += `
          <div style="background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:4px; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
              <span>${w.name}</span>
              <span style="color:var(--accent-gold);">${w.cost} PO</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>Tamanho: ${w.size} | Dano: ${w.damage} | Crit: ${w.critical}</span>
              <span>Peso: ${w.weight} kg</span>
            </div>
          </div>
        `;
      });

      html += `
            </div>
          </div>

          <!-- Armor list -->
          <div>
            <h3 style="font-size:1.1rem; margin-bottom:10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:4px;">Armaduras e Escudos</h3>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:400px; overflow-y:auto; padding-right:5px;">
      `;

      window.DND3_Equipment.armor.forEach(a => {
        if (q && !a.name.toLowerCase().includes(q)) return;
        html += `
          <div style="background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:4px; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
              <span>${a.name} (${a.type})</span>
              <span style="color:var(--accent-gold);">${a.cost} PO</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>CA: +${a.acBonus} | Max Des: +${a.maxDex} | Pen: ${a.penalty}</span>
              <span>Peso: ${a.weight} kg</span>
            </div>
          </div>
        `;
      });

      window.DND3_Equipment.shields.forEach(s => {
        if (q && !s.name.toLowerCase().includes(q)) return;
        html += `
          <div style="background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:4px; font-size:0.85rem; border-left: 2px solid var(--accent-gold);">
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
              <span>${s.name} (Escudo)</span>
              <span style="color:var(--accent-gold);">${s.cost} PO</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>CA: +${s.acBonus} | Pen: ${s.penalty}</span>
              <span>Peso: ${s.weight} kg</span>
            </div>
          </div>
        `;
      });

      html += `
            </div>
          </div>
        </div>
      `;
    } else if (this.compendiumSubtab === 'dmscreen') {
      const cards = [
        {
          title: "Testes Básicos & Resistências",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Jogadas de Salvamento (Saving Throws)</strong>: Testes para evitar ou reduzir perigos.</p>
              <table class="rpg-table" style="margin:0; font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>Salvamento</th>
                    <th>Atributo</th>
                    <th>Efeito Típico</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Fortitude</strong></td>
                    <td>Constituição (CON)</td>
                    <td>Resistir a venenos, doenças, paralisia, efeitos físicos nocivos.</td>
                  </tr>
                  <tr>
                    <td><strong>Reflexos</strong></td>
                    <td>Destreza (DES)</td>
                    <td>Esquivar de armadilhas de área, sopros de dragão, bolas de fogo.</td>
                  </tr>
                  <tr>
                    <td><strong>Vontade</strong></td>
                    <td>Sabedoria (SAB)</td>
                    <td>Resistir a controle mental, ilusões, feitiços de charme.</td>
                  </tr>
                </tbody>
              </table>
              <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.75rem; border-left: 2px solid var(--accent-gold);">
                <strong>Fórmula</strong>: <code>1d20 + BBA de Resistência + Modificador de Atributo + Bônus Diversos</code>
              </div>
              <p><strong>Testes de Atributo Bruto (Ability Checks)</strong>: Usado quando nenhuma perícia específica se aplica (ex: arrombar uma porta com Força, manter o equilíbrio em gelo com Destreza).</p>
              <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.75rem; border-left: 2px solid var(--accent-gold);">
                <strong>Fórmula</strong>: <code>1d20 + Modificador de Atributo</code>
              </div>
            </div>
          `
        },
        {
          title: "Classes de Dificuldade (CD) & Magias",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Dificuldades Comuns de Testes (CD)</strong>:</p>
              <table class="rpg-table" style="margin:0; font-size:0.8rem;">
                <thead>
                  <tr>
                    <th>Dificuldade</th>
                    <th>CD</th>
                    <th>Dificuldade</th>
                    <th>CD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Muito Fácil</td>
                    <td style="color:var(--accent-gold);">0</td>
                    <td>Muito Difícil</td>
                    <td style="color:var(--accent-gold);">20</td>
                  </tr>
                  <tr>
                    <td>Fácil</td>
                    <td style="color:var(--accent-gold);">5</td>
                    <td>Heroica</td>
                    <td style="color:var(--accent-gold);">25</td>
                  </tr>
                  <tr>
                    <td>Média</td>
                    <td style="color:var(--accent-gold);">10</td>
                    <td>Quase Impossível</td>
                    <td style="color:var(--accent-gold);">30</td>
                  </tr>
                  <tr>
                    <td>Difícil</td>
                    <td style="color:var(--accent-gold);">15</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                </tbody>
              </table>
              <p><strong>CD de Resistência contra Magias</strong>: Determina a dificuldade para os oponentes resistirem às suas magias.</p>
              <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.75rem; border-left: 2px solid var(--accent-gold);">
                <strong>Fórmula</strong>: <code>10 + Nível da Magia + Modificador do Atributo + Outros Bônus (ex: Foco em Magia)</code>
              </div>
              <p><strong>Atributos Chave de Conjuração por Classe</strong>:</p>
              <ul style="padding-left: 20px; font-size: 0.8rem; display:flex; flex-direction:column; gap:4px;">
                <li><strong>Inteligência (INT)</strong>: Mago</li>
                <li><strong>Sabedoria (SAB)</strong>: Clérigo, Druida, Paladino, Ranger</li>
                <li><strong>Carisma (CAR)</strong>: Feiticeiro, Bardo</li>
              </ul>
            </div>
          `
        },
        {
          title: "Níveis de Magia & Nível de Conjurador",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Nível de Conjurador (Caster Level - CL)</strong>: Determina o alcance, direção e dano de muitas magias.</p>
              <ul style="padding-left: 20px; font-size: 0.8rem; display:flex; flex-direction:column; gap:4px;">
                <li><strong>Magos, Clérigos, Druidas, Feiticeiros, Bardos</strong>: O Nível de Conjurador é igual ao seu nível total na classe.</li>
                <li><strong>Paladinos e Rangers (D&D 3.0)</strong>: O Nível de Conjurador é igual a <strong>metade do seu nível de classe</strong>, começando apenas a partir do 4º nível (ex: Ranger de 6º nível conjura como CL 3).</li>
              </ul>
              <p><strong>Restrição de Atributo Mínimo</strong>: Para lançar qualquer magia de nível N, o conjurador precisa ter o atributo de conjuração chave correspondente igual a pelo menos <code>10 + N</code>.</p>
              <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.75rem; border-left: 2px solid var(--accent-gold);">
                <strong>Exemplo</strong>: Para conjurar uma magia de 4º nível, um Mago precisa ter Inteligência 14 ou mais, e um Clérigo precisa de Sabedoria 14 ou mais.
              </div>
            </div>
          `
        },
        {
          title: "Manobras de Combate (Grapple, Trip, Disarm)",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Agarrar (Grapple)</strong>: Inicia com um ataque de toque corpo a corpo (provoca AoO). Se acertar, faz-se um teste resistido de Agarrar: <code>BBA + Mod Força + Mod Tamanho</code>.</p>
              <table class="rpg-table" style="margin:0; font-size:0.75rem;">
                <thead>
                  <tr>
                    <th>Tamanho</th>
                    <th>Mod.</th>
                    <th>Tamanho</th>
                    <th>Mod.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Colossal</td>
                    <td style="color:var(--accent-gold);">+16</td>
                    <td>Médio</td>
                    <td style="color:var(--accent-gold);">0</td>
                  </tr>
                  <tr>
                    <td>Imenso</td>
                    <td style="color:var(--accent-gold);">+12</td>
                    <td>Pequeno</td>
                    <td style="color:var(--accent-gold);">-4</td>
                  </tr>
                  <tr>
                    <td>Enorme</td>
                    <td style="color:var(--accent-gold);">+8</td>
                    <td>Miúdo</td>
                    <td style="color:var(--accent-gold);">-8</td>
                  </tr>
                  <tr>
                    <td>Grande</td>
                    <td style="color:var(--accent-gold);">+4</td>
                    <td>Diminuto / Ínfimo</td>
                    <td style="color:var(--accent-gold);">-12 / -16</td>
                  </tr>
                </tbody>
              </table>
              <p><strong>Derrubar (Trip)</strong>: Ataque de toque desarmado (provoca AoO). Se acertar, faz-se um teste de Força ou Destreza resistido. Defensor ganha +4 por categoria maior que Médio e +4 se tiver estabilidade (ex: quadrúpede ou anão contra empurrões). Se o atacante falhar, o defensor pode tentar derrubá-lo de volta.</p>
              <p><strong>Desarmar (Disarm)</strong>: Teste de ataque resistido (provoca AoO). Ambos rolam jogada de ataque. Armas de tamanho maior ganham +4 de bônus por categoria de diferença. Sofrerá -4 de penalidade se atacar desarmado.</p>
            </div>
          `
        },
        {
          title: "Outras Manobras (Charge, Bull Rush, Overrun)",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Investida (Charge)</strong>: Mova-se até o dobro do seu deslocamento em linha reta. Dá +2 de bônus na jogada de ataque e -2 de penalidade na CA por 1 rodada.</p>
              <p><strong>Investida de Touro (Bull Rush)</strong>: Empurrar o oponente para trás (provoca AoO). Teste de Força resistido: <code>1d20 + Mod Força + Mod Tamanho</code>. Se vencer, empurra o defensor 1,5m mais 1,5m adicionais para cada 5 pontos de diferença.</p>
              <p><strong>Atropelar (Overrun)</strong>: Passar por cima de um inimigo enquanto se move. O defensor pode escolher desviar ou resistir. Se resistir, faz-se um teste resistido de Força (atacante) vs. Força ou Destreza (defensor). O derrotado é derrubado.</p>
            </div>
          `
        },
        {
          title: "Tabela de Experiência (XP) & Progressão de Nível (Níveis 1 ao 50)",
          content: `
            <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:8px;">
              <p><strong>Regra Oficial do Livro do Jogador (Tabela 3-2) & Livro dos Níveis Épicos (1 ao 50)</strong>:</p>
              <div style="background:rgba(212,175,55,0.08); padding:8px; border-radius:4px; font-size:0.78rem; border-left:3px solid var(--accent-gold);">
                <strong>Fórmula de XP Total</strong>: <code>XP = (Nível * (Nível - 1) / 2) * 1.000</code><br>
                <strong>Para subir de nível</strong>: Do Nível <em>N</em> para <em>N+1</em>, o herói precisa acumular <code>N * 1.000</code> XP adicionais.
              </div>
              <div style="max-height: 320px; overflow-y: auto; border: 1px solid rgba(212,175,55,0.2); border-radius: 4px;">
                <table class="rpg-table" style="margin:0; font-size:0.75rem; width:100%;">
                  <thead style="position:sticky; top:0; background:#221a0f; z-index:1;">
                    <tr>
                      <th>Nível</th>
                      <th>XP Total Acumulado</th>
                      <th>+XP p/ Próximo</th>
                      <th>Atributo</th>
                      <th>Talento</th>
                      <th>Máx Perícia (Classe/Cruzada)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Array.from({ length: 50 }, (_, i) => {
                      const lvl = i + 1;
                      const totalXp = (lvl * (lvl - 1) / 2) * 1000;
                      const neededForNext = lvl * 1000;
                      const hasAttr = (lvl % 4 === 0) ? '+1 Atributo' : '-';
                      const hasFeat = (lvl === 1 || lvl % 3 === 0) ? '+1 Talento' : '-';
                      const maxClass = lvl + 3;
                      const maxCross = (lvl + 3) / 2;
                      const isEpic = lvl >= 21;
                      const isMilestone = lvl % 5 === 0 || lvl === 1;
                      return `
                        <tr style="${isMilestone ? 'background:rgba(212,175,55,0.15); font-weight:bold;' : (isEpic ? 'background:rgba(255,255,255,0.02);' : '')}">
                          <td style="color:var(--accent-gold); text-align:center;">${lvl} ${isEpic ? '⭐' : ''}</td>
                          <td style="text-align:right; font-family:monospace;">${totalXp.toLocaleString('pt-BR')} XP</td>
                          <td style="text-align:right; color:#2ecc71; font-family:monospace;">+${neededForNext.toLocaleString('pt-BR')} XP</td>
                          <td style="text-align:center; color:${hasAttr !== '-' ? '#f59e0b' : 'inherit'};">${hasAttr}</td>
                          <td style="text-align:center; color:${hasFeat !== '-' ? '#38bdf8' : 'inherit'};">${hasFeat}</td>
                          <td style="text-align:center;">${maxClass} / ${maxCross}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              <p style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
                ⭐ Níveis 21 ao 50 seguem as regras do <em>Epic Level Handbook</em>: BBA e Testes de Resistência ganham bônus épico de +1 a cada 2 níveis (21, 23, 25, 27, 29, 31... 49). Talentos épicos a cada 3 níveis e aumento de atributo a cada 4 níveis.
              </p>
            </div>
          `
        }
      ];

      html += `<div class="grid-2">`;
      cards.forEach(c => {
        if (q && !c.title.toLowerCase().includes(q) && !c.content.toLowerCase().includes(q)) {
          return;
        }
        html += `
          <div class="rpg-card" style="margin-bottom:0; background:var(--bg-card-light); border:var(--border-gold); display:flex; flex-direction:column; justify-content:space-between;">
            <h3 style="font-size:1.1rem; margin-bottom:12px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px; color:var(--accent-gold); text-transform:uppercase;">${c.title}</h3>
            ${c.content}
          </div>
        `;
      });
      html += `</div>`;
    }

    viewport.innerHTML = html;
  }

  handleLevelDown(char, oldLevel, newLevel) {
    if (newLevel >= oldLevel) return;
    
    this.updateMaxHp(char);
    char.currentHp = Math.min(char.currentHp || char.hpMax, char.hpMax);

    // Attribute points lost at levels multiple of 4 (4, 8, 12, 16, 20)
    let attributePointsLost = 0;
    for (let lvl = oldLevel; lvl > newLevel; lvl--) {
      if (lvl % 4 === 0) {
        attributePointsLost++;
      }
    }
    
    if (attributePointsLost > 0) {
      if (!char.levelUpAttributes) char.levelUpAttributes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
      for (let i = 0; i < attributePointsLost; i++) {
        const choice = prompt(`Você perdeu nível e regrediu de um nível múltiplo de 4!\n` +
          `Você deve escolher qual atributo REDUZIR em -1 ponto:\n` +
          `1 - Força (FOR)\n` +
          `2 - Destreza (DES)\n` +
          `3 - Constituição (CON)\n` +
          `4 - Inteligência (INT)\n` +
          `5 - Sabedoria (SAB)\n` +
          `6 - Carisma (CAR)\n\n` +
          `Digite o número da sua escolha (1-6):`
        );
        const attrMap = { '1': 'str', '2': 'dex', '3': 'con', '4': 'int', '5': 'wis', '6': 'cha' };
        const chosenAttr = attrMap[choice?.trim()];
        if (chosenAttr) {
          char.levelUpAttributes[chosenAttr] = Math.max(0, (char.levelUpAttributes[chosenAttr] || 0) - 1);
          alert(`-1 removido de ${chosenAttr.toUpperCase()} com sucesso!`);
        } else {
          alert(`Escolha inválida ou cancelada. Reduzindo Força (FOR) por padrão.`);
          char.levelUpAttributes.str = Math.max(0, (char.levelUpAttributes.str || 0) - 1);
        }
      }
    }
  }

  meetsPrestigeRequirements(char, classKey) {
    const prestigeClasses = ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'];
    if (!prestigeClasses.includes(classKey)) return true;

    const bab = char.bab || 0;

    switch (classKey) {
      case 'arcane_archer':
        const isElf = char.race === 'elf' || char.race === 'half_elf';
        const hasArcaneArcherFeats = (char.feats || []).includes('point_blank_shot') &&
                                     (char.feats || []).includes('precise_shot') &&
                                     (char.feats || []).includes('weapon_focus');
        const hasArcaneCaster = (char.classes || []).some(c => c.classKey === 'bard' || c.classKey === 'sorcerer' || c.classKey === 'wizard');
        return isElf && bab >= 6 && hasArcaneArcherFeats && hasArcaneCaster;

      case 'assassin':
        const isEvil = char.alignment === 'le' || char.alignment === 'ne' || char.alignment === 'ce';
        const hideRanks = char.skillRanks?.hide || 0;
        const moveSilentlyRanks = char.skillRanks?.move_silently || 0;
        const disguiseRanks = char.skillRanks?.disguise || 0;
        return isEvil && hideRanks >= 8 && moveSilentlyRanks >= 8 && disguiseRanks >= 4;

      case 'blackguard':
        const isBlackguardEvil = char.alignment === 'le' || char.alignment === 'ne' || char.alignment === 'ce';
        return isBlackguardEvil && bab >= 6;

      case 'dwarven_defender':
        const isDwarf = char.race === 'dwarf';
        const isLawful = char.alignment === 'lg' || char.alignment === 'ln' || char.alignment === 'le';
        const hasDwarvenDefenderFeats = (char.feats || []).includes('dodge') &&
                                        (char.feats || []).includes('endurance') &&
                                        (char.feats || []).includes('toughness');
        return isDwarf && isLawful && bab >= 7 && hasDwarvenDefenderFeats;

      case 'shadowdancer':
        const sdHideRanks = char.skillRanks?.hide || 0;
        const sdMoveSilentlyRanks = char.skillRanks?.move_silently || 0;
        const sdTumbleRanks = char.skillRanks?.tumble || 0;
        const hasShadowdancerFeats = (char.feats || []).includes('dodge') &&
                                     (char.feats || []).includes('mobility') &&
                                     (char.feats || []).includes('combat_reflexes');
        return sdHideRanks >= 10 && sdMoveSilentlyRanks >= 8 && sdTumbleRanks >= 5 && hasShadowdancerFeats;

      case 'loremaster':
        const knowledgesCount = Object.keys(char.skillRanks || {}).filter(k => k.startsWith('knowledge_') && char.skillRanks[k] >= 10).length;
        const metamagicItemFeatsCount = (char.feats || []).filter(f => ['scribe_scroll', 'brew_potion', 'empower_spell', 'extend_spell'].includes(f)).length;
        const hasSkillFocus = (char.feats || []).includes('skill_focus');
        const hasThirdLevelSpells = (char.classes || []).some(c => {
          if (c.classKey === 'cleric' || c.classKey === 'druid' || c.classKey === 'wizard') return c.level >= 5;
          if (c.classKey === 'sorcerer') return c.level >= 6;
          if (c.classKey === 'bard') return c.level >= 7;
          return false;
        });
        return knowledgesCount >= 2 && metamagicItemFeatsCount >= 3 && hasSkillFocus && hasThirdLevelSpells;

      case 'vingador_goriaque':
        const isNonEvil = char.alignment !== 'le' && char.alignment !== 'ne' && char.alignment !== 'ce';
        return isNonEvil && bab >= 5;

      case 'order_of_the_bow_initiate':
        const hasBowFeats = (char.feats || []).includes('point_blank_shot') &&
                            (char.feats || []).includes('precise_shot') &&
                            (char.feats || []).includes('weapon_focus');
        return bab >= 5 && hasBowFeats;

      case 'mage_of_the_arcane_order':
        const hasArcane2nd = (char.classes || []).some(c => (c.classKey === 'wizard' && c.level >= 3) || (c.classKey === 'sorcerer' && c.level >= 4));
        const spellcraftRanks = char.skillRanks?.spellcraft || 0;
        const arcanaRanks = char.skillRanks?.knowledge_arcana || 0;
        return (hasArcane2nd || char.level >= 3) && spellcraftRanks >= 8 && arcanaRanks >= 8;

      case 'sacerdote_errante':
        const relRanks = char.skillRanks?.knowledge_religion || 0;
        return bab >= 5 && relRanks >= 8;

      default:
        return true;
    }
  }

  promptLevelUp(char, oldLevel, targetLvl, currentLvl = oldLevel) {
    const nextLvl = currentLvl + 1;
    if (nextLvl > targetLvl) {
      this.finishClassLevelUps(char, oldLevel, targetLvl);
      return;
    }

    const modalBody = document.getElementById('modal-body-content');
    if (!modalBody) return;

    // Generate list of options:
    // 1. Current classes
    let currentClassesHtml = (char.classes || []).map(c => {
      const className = window.DND3_Classes[c.classKey]?.name || c.classKey;
      return `
        <button class="rpg-btn" style="width:100%; text-align:left; margin-bottom:10px; padding:10px; display:flex; justify-content:space-between; align-items:center;" onclick="app.selectLevelUpClass('${char.id}', '${c.classKey}', ${oldLevel}, ${targetLvl}, ${currentLvl})">
          <span>⚔️ Subir <strong>${className}</strong></span>
          <span style="font-size:0.8rem; color:var(--accent-gold);">Nível Atual: ${c.level} &rarr; ${c.level + 1}</span>
        </button>
      `;
    }).join('');

    // 2. Multiclass options (all other classes in DND3_Classes)
    let multiclassOptions = [];
    for (let classKey in window.DND3_Classes) {
      // Don't show if already in current classes
      if ((char.classes || []).some(c => c.classKey === classKey)) continue;

      const isPrestige = ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(classKey);
      const meetsReqs = this.meetsPrestigeRequirements(char, classKey);

      multiclassOptions.push({
        key: classKey,
        name: window.DND3_Classes[classKey].name,
        isPrestige: isPrestige,
        meetsReqs: meetsReqs
      });
    }

    let multiclassHtml = "";
    if (multiclassOptions.length > 0) {
      multiclassHtml = `
        <h4 style="margin-top:20px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px; color:var(--accent-gold);">Adquirir Nova Classe (Multiclasse)</h4>
        <div style="max-height: 200px; overflow-y: auto; margin-top:10px; padding-right:5px;">
          ${multiclassOptions.map(o => `
            <button class="rpg-btn rpg-btn-secondary" style="width:100%; text-align:left; margin-bottom:8px; padding:8px; display:flex; justify-content:space-between; align-items:center;" onclick="app.selectLevelUpClass('${char.id}', '${o.key}', ${oldLevel}, ${targetLvl}, ${currentLvl})">
              <span>🛡️ ${o.name} ${o.isPrestige ? '<span style="font-size:0.7rem; background:rgba(212,175,55,0.15); color:var(--accent-gold); padding:2px 6px; border-radius:4px; margin-left:5px;">Prestígio</span>' : ''}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">Iniciar no Nível 1</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family:var(--font-header); text-align: center; color: var(--accent-gold); display:flex; align-items:center; justify-content:center; gap:10px;">
        <span>⚔️ SUBIU DE NÍVEL! ⚔️</span>
      </h3>
      <p style="margin-bottom: 1.5rem; text-align: center; font-size: 0.95rem; color: var(--text-parchment); line-height: 1.4;">
        O herói <strong>${char.name}</strong> subiu de nível!<br>
        Selecione a classe para o <strong>Nível ${nextLvl}</strong> (Nível Total):
      </p>
      
      <div style="display:flex; flex-direction:column; gap:5px;">
        <h4 style="border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:5px; color:var(--accent-gold);">Subir Classe Atual</h4>
        ${currentClassesHtml}
      </div>

      ${multiclassHtml}
    `;

    this.showModal();
  }

  selectLevelUpClass(charId, classKey, oldLevel, targetLvl, currentLvl) {
    const isNew = !charId || charId === 'null' || charId === 'undefined';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.classes) {
      char.classes = [{ classKey: char.class || 'fighter', level: oldLevel }];
    }

    // Increment level for selected class
    let classObj = char.classes.find(c => c.classKey === classKey);
    if (classObj) {
      classObj.level++;
    } else {
      char.classes.push({ classKey: classKey, level: 1 });
    }

    // Update total level
    char.level = char.classes.reduce((acc, c) => acc + c.level, 0);

    // Call promptLevelUp for the next level
    this.promptLevelUp(char, oldLevel, targetLvl, currentLvl + 1);
  }

  promptLevelUpAttributes(char, totalPoints, allocatedPoints, onComplete) {
    if (allocatedPoints >= totalPoints) {
      onComplete();
      return;
    }

    const modalBody = document.getElementById('modal-body-content');
    if (!modalBody) return;

    const attributes = [
      { key: 'str', name: 'Força (FOR)' },
      { key: 'dex', name: 'Destreza (DES)' },
      { key: 'con', name: 'Constituição (CON)' },
      { key: 'int', name: 'Inteligência (INT)' },
      { key: 'wis', name: 'Sabedoria (SAB)' },
      { key: 'cha', name: 'Carisma (CAR)' }
    ];

    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family:var(--font-header); text-align: center; color: var(--accent-gold);">🌟 PONTO DE ATRIBUTO 🌟</h3>
      <p style="margin-bottom: 1.5rem; text-align: center; font-size: 0.95rem; color: var(--text-parchment); line-height: 1.4;">
        Você alcançou um nível múltiplo de 4 e ganhou +1 ponto de atributo!<br>
        Escolha qual atributo aumentar (Ponto ${allocatedPoints + 1} de ${totalPoints}):
      </p>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
        ${attributes.map(a => `
          <button class="rpg-btn" style="padding:12px; font-family:var(--font-header); justify-content:center;" onclick="app.selectLevelUpAttribute('${char.id}', '${a.key}', ${totalPoints}, ${allocatedPoints})">
            ${a.name}
          </button>
        `).join('')}
      </div>
    `;

    this.showModal();
  }

  selectLevelUpAttribute(charId, attrKey, totalPoints, allocatedPoints) {
    const isNew = !charId || charId === 'null' || charId === 'undefined';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.levelUpAttributes) {
      char.levelUpAttributes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    }
    char.levelUpAttributes[attrKey] = (char.levelUpAttributes[attrKey] || 0) + 1;

    // Check if we need more attribute points
    this.promptLevelUpAttributes(char, totalPoints, allocatedPoints + 1, () => {
      this.finishLevelUp(char);
    });
  }

  finishClassLevelUps(char, oldLevel, targetLvl) {
    this.updateMaxHp(char);
    char.currentHp = char.hpMax;

    // Attribute point at level 4, 8, 12, 16, 20
    let attributePointsGained = 0;
    for (let lvl = oldLevel + 1; lvl <= targetLvl; lvl++) {
      if (lvl % 4 === 0) {
        attributePointsGained++;
      }
    }

    if (attributePointsGained > 0) {
      this.promptLevelUpAttributes(char, attributePointsGained, 0, () => {
        this.finishLevelUp(char);
      });
    } else {
      this.finishLevelUp(char);
    }
  }

  finishLevelUp(char) {
    this.levelUpInProgress = false;
    this.closeModal();
    this.normalizeCharacter(char, true);
    
    const isNew = char === this.newChar;
    
    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }
    
    // Re-render
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      if (isNew) {
        this.renderOfficialSheet(char, container, true);
      } else {
        this.renderCharacterSheetDetails(char, container);
      }
    }
    
    this.showLevelUpAnnouncement(char.level);
  }

  handleLevelUp(char, oldLevel, newLevel) {
    this.promptLevelUp(char, oldLevel, newLevel);
  }

  getLevelFromXp(xp) {
    let lvl = 1;
    while (true) {
      let nextLvlXp = (lvl * (lvl + 1) / 2) * 1000;
      if (xp >= nextLvlXp) {
        lvl++;
      } else {
        break;
      }
    }
    return lvl;
  }

  getXpRequiredForLevel(lvl) {
    if (lvl <= 1) return 0;
    return (lvl * (lvl - 1) / 2) * 1000;
  }

  sheetAddXp(charId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const input = document.getElementById('sheet-xp-gain');
    if (!input) return;

    const xpGain = parseInt(input.value);
    if (isNaN(xpGain) || xpGain <= 0) {
      alert("Por favor, digite uma quantidade de XP válida.");
      return;
    }

    const currentDate = new Date().toLocaleDateString('pt-BR');
    if (!char.xpSessions) char.xpSessions = [];
    char.xpSessions.push({
      sessionName: `Ganho de XP (${currentDate})`,
      xpAmt: xpGain
    });

    input.value = '';

    this.normalizeCharacter(char, false);
    this.saveCharactersState();

    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  sheetEditModal(charId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    this._editingChar = char;
    const modalBody = document.getElementById('modal-body-content');

    const rc = window.DND3_Races[char.race];
    const cl = window.DND3_Classes[char.class];

    // Ability bases
    const baseObj = char.abilitiesBase;

    // Calculate level-up points allocated vs total
    const totalLvlUp = Math.floor((char.level || 1) / 4);
    const allocatedLvlUp = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((acc, a) => acc + (char.levelUpAttributes?.[a] || 0), 0);
    const availableLvlUp = Math.max(0, totalLvlUp - allocatedLvlUp);

    // Feats checkboxes
    let featsHtml = `
      <div style="margin-bottom: 8px;">
        <input type="text" id="edit-feat-search-input" class="rpg-input" placeholder="Pesquisar talentos..." oninput="app.filterEditFeatCheckboxes()" style="width: 100%; height:30px; background:rgba(0,0,0,0.3); border-color:rgba(212,175,55,0.4); color:var(--text-parchment);">
      </div>
      <div id="edit-feats-list-container" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.8rem; max-height: 120px; overflow-y: auto; padding-right:5px;">
    `;
    for (let fKey in window.DND3_Feats) {
      const feat = window.DND3_Feats[fKey];
      const isChecked = char.feats.includes(fKey) ? 'checked' : '';
      featsHtml += `
        <label style="display:flex; align-items:center; gap:5px; cursor:pointer;" data-feat-name="${feat.name.toLowerCase()}" data-feat-benefit="${feat.benefit.toLowerCase()}">
          <input type="checkbox" id="edit-feat-${fKey}" ${isChecked}>
          <span><strong>${feat.name}:</strong> ${feat.benefit}</span>
        </label>
      `;
    }
    featsHtml += '</div>';

    // Skills inputs
    let skillsHtml = `
      <div style="margin-bottom: 8px;">
        <input type="text" id="edit-skill-search-input" class="rpg-input" placeholder="Pesquisar perícias..." oninput="app.filterEditSkillInputs()" style="width: 100%; height:30px; background:rgba(0,0,0,0.3); border-color:rgba(212,175,55,0.4); color:var(--text-parchment);">
      </div>
      <div id="edit-skills-list-container" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-height:180px; overflow-y:auto; padding-right:5px;">
    `;
    const skillKeys = Object.keys(window.DND3_Skills).sort((a,b) => window.DND3_Skills[a].name.localeCompare(window.DND3_Skills[b].name));
    skillKeys.forEach(k => {
      const sk = window.DND3_Skills[k];
      const ranks = char.skillRanks[k] || 0;
      const isClass = cl.classSkills.includes(k);
      skillsHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:4px 8px; border-radius:4px; font-size:0.85rem;" data-skill-name="${sk.name.toLowerCase()}">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;" title="${sk.name}">${sk.name} ${isClass ? '(C)' : ''}</span>
          <input type="number" id="edit-skill-${k}" class="rpg-input" style="width:60px; padding:2px; text-align:center;" min="0" max="23" value="${ranks}">
        </div>
      `;
    });
    skillsHtml += '</div>';

    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1rem; font-family:var(--font-header);">Editar Personagem: ${char.name}</h3>
      
      <div style="max-height: 55vh; overflow-y: auto; padding-right: 5px;">
        <!-- Ability Scores -->
        <h4 style="color:var(--accent-gold); margin-bottom: 10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; font-size:0.9rem;">Atributos Básicos (Sem modificadores raciais)</h4>
        <div class="grid-6" style="margin-bottom:10px;">
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">FOR</label>
            <input type="number" id="edit-str" class="rpg-input" min="3" max="30" value="${baseObj.str}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">DES</label>
            <input type="number" id="edit-dex" class="rpg-input" min="3" max="30" value="${baseObj.dex}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">CON</label>
            <input type="number" id="edit-con" class="rpg-input" min="3" max="30" value="${baseObj.con}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">INT</label>
            <input type="number" id="edit-int" class="rpg-input" min="3" max="30" value="${baseObj.int}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">SAB</label>
            <input type="number" id="edit-wis" class="rpg-input" min="3" max="30" value="${baseObj.wis}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label" style="font-size:0.75rem;">CAR</label>
            <input type="number" id="edit-cha" class="rpg-input" min="3" max="30" value="${baseObj.cha}">
          </div>
        </div>

        <!-- Level-up attribute increases -->
        <h4 style="color:var(--accent-gold); margin-bottom: 5px; margin-top: 15px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; font-size:0.9rem;">Pontos de Atributo por Nível (Ganhos a cada 4 níveis)</h4>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">
          Pontos Totais: <strong id="edit-lvlup-total" style="color:var(--accent-gold); font-size:0.9rem;">${totalLvlUp}</strong> | 
          Disponíveis: <strong id="edit-lvlup-available" style="color:#aa7c11; font-size:0.9rem;">${availableLvlUp}</strong>
        </div>
        <div class="grid-6" style="margin-bottom:20px;">
          ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(a => {
            const val = char.levelUpAttributes?.[a] || 0;
            return `
              <div class="rpg-form-group" style="text-align:center;">
                <label class="rpg-label" style="font-size:0.75rem; color:#888;">+ ${a.toUpperCase()}</label>
                <div style="display:flex; align-items:center; justify-content:center; gap:2px; margin-top:2px;">
                  <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:24px; min-width:18px; line-height:1;" onclick="app.adjustEditLvlUp('${a}', -1)">-</button>
                  <span id="edit-lvlup-val-${a}" style="font-weight:bold; font-size:0.95rem; min-width:20px; display:inline-block; font-family:'Inter', sans-serif;">${val}</span>
                  <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:24px; min-width:18px; line-height:1;" onclick="app.adjustEditLvlUp('${a}', 1)">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Multiclass Section -->
        <h4 style="color:var(--accent-gold); margin-bottom: 10px; margin-top: 15px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; font-size:0.9rem;">Multiclasses & Níveis</h4>
        <div id="edit-classes-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <!-- Rendered by app.renderEditMulticlass() -->
        </div>
        <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center;">
          <select id="edit-add-class-select" class="rpg-select" style="flex:1; height:32px; font-size:0.85rem; padding: 2px 6px;">
            <option value="">-- Adicionar Nova Classe --</option>
            <optgroup label="Classes Básicas">
              ${Object.keys(window.DND3_Classes).filter(k => !['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(k)).map(k => `<option value="${k}">${window.DND3_Classes[k].name}</option>`).join('')}
            </optgroup>
            <optgroup label="Classes de Prestígio">
              ${Object.keys(window.DND3_Classes).filter(k => ['arcane_archer', 'assassin', 'blackguard', 'dwarven_defender', 'shadowdancer', 'loremaster', 'vingador_goriaque', 'order_of_the_bow_initiate', 'mage_of_the_arcane_order', 'sacerdote_errante'].includes(k)).map(k => `<option value="${k}">${window.DND3_Classes[k].name}</option>`).join('')}
            </optgroup>
          </select>
          <button class="rpg-btn" style="padding:4px 12px; font-size:0.8rem; height:32px;" onclick="app.addEditClass()">Adicionar</button>
        </div>

        <!-- HP, Gold & XP -->
        <div class="grid-4" style="margin-bottom:20px;">
          <div class="rpg-form-group">
            <label class="rpg-label">PV Máximo (Total)</label>
            <input type="number" id="edit-hp-max" class="rpg-input" min="1" value="${char.hpMax || 10}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label">PV Atual</label>
            <input type="number" id="edit-hp-current" class="rpg-input" value="${char.currentHp !== undefined ? char.currentHp : (char.hpMax || 10)}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label">Ouro Total (PO)</label>
            <input type="number" id="edit-gold" class="rpg-input" value="${char.gold || 0}">
          </div>
          <div class="rpg-form-group">
            <label class="rpg-label">XP Acumulado</label>
            <input type="number" id="edit-xp" class="rpg-input" min="0" value="${char.xp || 0}">
          </div>
        </div>

        <!-- Skills -->
        <h4 style="color:var(--accent-gold); margin-bottom: 10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; font-size:0.9rem;">Graduações em Perícias</h4>
        <div style="margin-bottom:20px;">
          ${skillsHtml}
        </div>

        <!-- Feats -->
        <h4 style="color:var(--accent-gold); margin-bottom: 10px; border-bottom:1px solid rgba(212,175,55,0.2); padding-bottom:3px; font-size:0.9rem;">Talentos Disponíveis</h4>
        <div style="margin-bottom:20px;">
          ${featsHtml}
        </div>

        <!-- Notes -->
        <div class="rpg-form-group">
          <label class="rpg-label">Histórico e Notas</label>
          <textarea id="edit-notes" class="rpg-input" style="height:60px; resize:vertical;">${char.notes || ''}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1.5rem; border-top:1px solid rgba(212,175,55,0.2); padding-top:10px;">
        <button class="rpg-btn rpg-btn-secondary" onclick="app.closeModal()">Cancelar</button>
        <button class="rpg-btn" onclick="app.sheetUpdateStats('${char.id}')">Salvar Ficha</button>
      </div>
    `;

    setTimeout(() => this.renderEditMulticlass(), 0);
    this.showModal();
  }

  filterEditFeatCheckboxes() {
    const input = document.getElementById('edit-feat-search-input');
    const q = input ? input.value.toLowerCase() : '';
    const container = document.getElementById('edit-feats-list-container');
    if (!container) return;
    const labels = container.querySelectorAll('label');
    labels.forEach(label => {
      const name = label.getAttribute('data-feat-name') || '';
      const benefit = label.getAttribute('data-feat-benefit') || '';
      if (name.includes(q) || benefit.includes(q)) {
        label.style.display = 'flex';
      } else {
        label.style.display = 'none';
      }
    });
  }

  filterEditSkillInputs() {
    const input = document.getElementById('edit-skill-search-input');
    const q = input ? input.value.toLowerCase() : '';
    const container = document.getElementById('edit-skills-list-container');
    if (!container) return;
    const rows = container.querySelectorAll('div[data-skill-name]');
    rows.forEach(row => {
      const name = row.getAttribute('data-skill-name') || '';
      if (name.includes(q)) {
        row.style.display = 'flex';
      } else {
        row.style.display = 'none';
      }
    });
  }

  renderEditMulticlass() {
    const char = this._editingChar;
    if (!char) return;

    if (!char.classes || char.classes.length === 0) {
      char.classes = [ { classKey: char.class || 'fighter', level: char.level || 1 } ];
    }

    const container = document.getElementById('edit-classes-list');
    if (!container) return;

    container.innerHTML = char.classes.map((c, idx) => {
      const cls = window.DND3_Classes[c.classKey];
      const name = cls ? cls.name : c.classKey;
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:6px 10px; border-radius:4px;">
          <strong style="color:var(--accent-gold); font-size:0.85rem;">${name}</strong>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:24px; min-width:18px; line-height:1;" onclick="app.adjustEditClassLvl('${c.classKey}', -1)">-</button>
            <span style="font-weight:bold; font-size:0.95rem; min-width:20px; text-align:center; display:inline-block; font-family:'Inter', sans-serif;">${c.level}</span>
            <button class="rpg-btn" style="padding:2px 6px; font-size:0.7rem; height:24px; min-width:18px; line-height:1;" onclick="app.adjustEditClassLvl('${c.classKey}', 1)">+</button>
            ${char.classes.length > 1 ? `
              <button class="rpg-btn rpg-btn-secondary" style="border-color:#ff4444; color:#ff4444; padding:2px 8px; font-size:0.7rem; height:24px; line-height:1;" onclick="app.removeEditClass('${c.classKey}')">Remover</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Update total level and level-up points available preview
    const totalLevel = char.classes.reduce((acc, c) => acc + c.level, 0);
    const totalLvlUp = Math.floor(totalLevel / 4);
    const allocatedLvlUp = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((acc, a) => acc + (char.levelUpAttributes?.[a] || 0), 0);
    const availableLvlUp = Math.max(0, totalLvlUp - allocatedLvlUp);

    const totalEl = document.getElementById('edit-lvlup-total');
    if (totalEl) totalEl.textContent = totalLvlUp;

    const availEl = document.getElementById('edit-lvlup-available');
    if (availEl) availEl.textContent = availableLvlUp;
  }

  addEditClass() {
    const char = this._editingChar;
    if (!char) return;

    const select = document.getElementById('edit-add-class-select');
    if (!select) return;

    const classKey = select.value;
    if (!classKey) {
      alert("Por favor, selecione uma classe válida.");
      return;
    }

    if (!char.classes) char.classes = [];
    if (char.classes.some(c => c.classKey === classKey)) {
      alert("O personagem já possui esta classe.");
      return;
    }

    char.classes.push({ classKey: classKey, level: 1 });
    this.renderEditMulticlass();
    select.value = "";
  }

  adjustEditClassLvl(classKey, delta) {
    const char = this._editingChar;
    if (!char) return;

    const record = char.classes.find(c => c.classKey === classKey);
    if (!record) return;

    const nextLvl = record.level + delta;
    if (nextLvl < 1) return;

    record.level = nextLvl;
    this.renderEditMulticlass();
  }

  removeEditClass(classKey) {
    const char = this._editingChar;
    if (!char) return;

    if (char.classes.length <= 1) return;

    char.classes = char.classes.filter(c => c.classKey !== classKey);
    this.renderEditMulticlass();
  }

  sheetUpdateStats(charId) {
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const oldLevel = char.level || 1;
    const attrKey = 'abilitiesBase';
    
    // Capture old values for history logging
    const oldStr = char[attrKey].str || 10;
    const oldDex = char[attrKey].dex || 10;
    const oldCon = char[attrKey].con || 10;
    const oldInt = char[attrKey].int || 10;
    const oldWis = char[attrKey].wis || 10;
    const oldCha = char[attrKey].cha || 10;
    const oldGold = char.gold || 0;
    const oldXp = char.xp || 0;

    // Capture old Con modifier before changes
    const oldConVal = char[attrKey].con || 10;
    const oldConOffset = char.abilitiesTemp?.con !== undefined && char.abilitiesTemp?.con !== null && char.abilitiesTemp?.con !== "" ? parseInt(char.abilitiesTemp.con) : 0;
    const oldActiveConMod = Math.floor((oldConVal + oldConOffset - 10) / 2);

    char[attrKey].str = parseInt(document.getElementById('edit-str').value) || 10;
    char[attrKey].dex = parseInt(document.getElementById('edit-dex').value) || 10;
    char[attrKey].con = parseInt(document.getElementById('edit-con').value) || 10;
    char[attrKey].int = parseInt(document.getElementById('edit-int').value) || 10;
    char[attrKey].wis = parseInt(document.getElementById('edit-wis').value) || 10;
    char[attrKey].cha = parseInt(document.getElementById('edit-cha').value) || 10;

    // Calculate new Con modifier and apply changes to current HP
    const newConVal = char[attrKey].con;
    const newActiveConMod = Math.floor((newConVal + oldConOffset - 10) / 2);
    if (newActiveConMod !== oldActiveConMod) {
      const conDiff = newActiveConMod - oldActiveConMod;
      char.currentHp = (char.currentHp || 10) + (conDiff * (char.level || 1));
    }

    // Gold & XP
    char.gold = parseInt(document.getElementById('edit-gold').value) || 0;
    
    // Recalculate level from classes sum
    char.level = char.classes.reduce((acc, c) => acc + c.level, 0);

    const oldXpVal = char.xp || 0;
    let newXp = parseInt(document.getElementById('edit-xp').value) || 0;
    
    // Ensure XP matches at least the minimum for the new total level
    const minXp = this.getXpRequiredForLevel(char.level);
    if (newXp < minXp) {
      newXp = minXp;
    }
    
    const diff = newXp - oldXpVal;
    if (diff !== 0) {
      if (!char.xpSessions) char.xpSessions = [];
      const currentDate = new Date().toLocaleDateString('pt-BR');
      char.xpSessions.push({
        sessionName: `Ajuste por Edição (${currentDate})`,
        xpAmt: diff
      });
    }
    char.xp = newXp;

    // Run normalizeCharacter to recalculate level, BAB, and base saves from new XP
    this.normalizeCharacter(char);

    // Notes
    char.notes = document.getElementById('edit-notes').value;

    // Skills
    for (let k in window.DND3_Skills) {
      const input = document.getElementById(`edit-skill-${k}`);
      if (input) {
        char.skillRanks[k] = parseInt(input.value) || 0;
      }
    }

    // Feats
    char.feats = [];
    for (let fKey in window.DND3_Feats) {
      const checkbox = document.getElementById(`edit-feat-${fKey}`);
      if (checkbox && checkbox.checked) {
        char.feats.push(fKey);
      }
    }

    // Manual HP editing
    const editedHpMax = parseInt(document.getElementById('edit-hp-max')?.value);
    const editedHpCurrent = parseInt(document.getElementById('edit-hp-current')?.value);
    if (!isNaN(editedHpMax) && editedHpMax > 0) {
      char.hpMax = editedHpMax;
    }
    if (!isNaN(editedHpCurrent)) {
      char.currentHp = editedHpCurrent;
    }

    // Recalculate derived stats
    char.derived = this.calculateDerivedStats(char);
    
    // Ensure current HP does not exceed max HP unless edited directly
    if (char.currentHp > (char.hpMax || char.derived.maxHp)) {
      char.currentHp = char.hpMax || char.derived.maxHp;
    }

    // Log changes to audit history
    let changeLogs = [];
    if (char[attrKey].str !== oldStr) changeLogs.push(`FOR: ${oldStr} -> ${char[attrKey].str}`);
    if (char[attrKey].dex !== oldDex) changeLogs.push(`DES: ${oldDex} -> ${char[attrKey].dex}`);
    if (char[attrKey].con !== oldCon) changeLogs.push(`CON: ${oldCon} -> ${char[attrKey].con}`);
    if (char[attrKey].int !== oldInt) changeLogs.push(`INT: ${oldInt} -> ${char[attrKey].int}`);
    if (char[attrKey].wis !== oldWis) changeLogs.push(`SAB: ${oldWis} -> ${char[attrKey].wis}`);
    if (char[attrKey].cha !== oldCha) changeLogs.push(`CAR: ${oldCha} -> ${char[attrKey].cha}`);
    if (char.gold !== oldGold) changeLogs.push(`Ouro: ${oldGold} PO -> ${char.gold} PO`);
    if (char.xp !== oldXp) changeLogs.push(`XP: ${oldXp} -> ${char.xp}`);
    if (char.level !== oldLevel) changeLogs.push(`Nível: ${oldLevel} -> ${char.level}`);
    
    if (changeLogs.length > 0) {
      this.logAction(`Alterou a ficha de ${char.name}: ${changeLogs.join(', ')}`);
    } else {
      this.logAction(`Salvou alterações na ficha de ${char.name}`);
    }

    this.saveCharactersState();
    this.closeModal();
    this.showToast("Alterações salvas com sucesso!");
    this.renderCharacterSheetDetails(char, document.getElementById('sheet-detail-view'));
  }

  toggleFeatActive(charId, featKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.activeFeats) char.activeFeats = {};
    const currentState = !!char.activeFeats[featKey];
    char.activeFeats[featKey] = !currentState;

    // Apply or subtract the bonuses/maluses
    this.applyFeatOrAbilityEffects(char, featKey, 'feat', !currentState);

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }
    
    // Re-render sheet to update UI
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  toggleAbilityActive(charId, abilityKey, isNewChar) {
    const isNew = isNewChar === true || isNewChar === 'true';
    const char = isNew ? this.newChar : this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    if (!char.activeSpecialAbilities) char.activeSpecialAbilities = {};
    const currentState = !!char.activeSpecialAbilities[abilityKey];
    char.activeSpecialAbilities[abilityKey] = !currentState;

    // Apply or subtract the bonuses/maluses
    this.applyFeatOrAbilityEffects(char, abilityKey, 'ability', !currentState);

    // Sync with rageActive if the toggled ability is rage
    if (abilityKey === 'rage') {
      char.rageActive = !currentState;
    }

    if (!isNew) {
      this.saveCharactersState();
    } else {
      localStorage.setItem('dnd3_new_char', JSON.stringify(this.newChar));
    }
    
    // Re-render sheet to update UI
    const containerId = isNew ? 'official-sheet-creator-container' : 'sheet-detail-view';
    const container = document.getElementById(containerId);
    if (container) {
      this.renderOfficialSheet(char, container, isNew);
    }
  }

  applyFeatOrAbilityEffects(char, key, type, isActive) {
    if (!char.abilitiesTemp) char.abilitiesTemp = { str: "", dex: "", con: "", int: "", wis: "", cha: "" };
    if (char.saveFortTemp === undefined) char.saveFortTemp = 0;
    if (char.saveRefTemp === undefined) char.saveRefTemp = 0;
    if (char.saveWillTemp === undefined) char.saveWillTemp = 0;
    if (char.acMisc === undefined) char.acMisc = 0;
    if (!char.initiativeMods) {
      char.initiativeMods = [
        { val: 0, desc: "" },
        { val: 0, desc: "" },
        { val: 0, desc: "" }
      ];
    }

    const adjustTempAttr = (attr, amt) => {
      let current = parseInt(char.abilitiesTemp[attr]) || 0;
      char.abilitiesTemp[attr] = isActive ? (current + amt) : Math.max(0, current - amt);
      if (char.abilitiesTemp[attr] === 0) char.abilitiesTemp[attr] = "";
    };

    const adjustTempSave = (saveField, amt) => {
      let current = parseInt(char[saveField]) || 0;
      char[saveField] = isActive ? (current + amt) : (current - amt);
    };

    const adjustTempAc = (amt) => {
      let current = parseInt(char.acMisc) || 0;
      char.acMisc = isActive ? (current + amt) : (current - amt);
    };

    const adjustInitiative = (amt, desc) => {
      if (isActive) {
        let slot = char.initiativeMods.find(m => !m.desc && !m.val);
        if (slot) {
          slot.val = amt;
          slot.desc = desc;
        } else {
          char.initiativeMods.push({ val: amt, desc: desc });
        }
      } else {
        let idx = char.initiativeMods.findIndex(m => m.desc === desc);
        if (idx !== -1) {
          char.initiativeMods.splice(idx, 1);
        }
        while (char.initiativeMods.length < 3) {
          char.initiativeMods.push({ val: 0, desc: "" });
        }
      }
    };

    if (type === 'feat') {
      switch(key) {
        case 'great_fortitude':
          adjustTempSave('saveFortTemp', 2);
          break;
        case 'lightning_reflexes':
          adjustTempSave('saveRefTemp', 2);
          break;
        case 'iron_will':
          adjustTempSave('saveWillTemp', 2);
          break;
        case 'dodge':
          adjustTempAc(1);
          break;
        case 'improved_initiative':
          adjustInitiative(4, "Iniciativa Aprimorada");
          break;
      }
    } else if (type === 'ability') {
      switch(key) {
        case 'rage':
          adjustTempAttr('str', 4);
          adjustTempAttr('con', 4);
          adjustTempSave('saveWillTemp', 2);
          adjustTempAc(-2);
          break;
        case 'divine_grace':
          const baseObj = char.abilitiesBase;
          const baseCha = baseObj?.cha || 10;
          const tempVal = char.abilitiesTemp?.cha;
          const chaOffset = (tempVal !== undefined && tempVal !== null && tempVal !== "") ? parseInt(tempVal) : 0;
          const chaVal = baseCha + chaOffset;
          const chaMod = Math.floor((chaVal - 10) / 2);
          if (chaMod > 0) {
            adjustTempSave('saveFortTemp', chaMod);
            adjustTempSave('saveRefTemp', chaMod);
            adjustTempSave('saveWillTemp', chaMod);
          }
          break;
        case 'still_mind':
          adjustTempSave('saveWillTemp', 2);
          break;
      }
    }
  }

  adjustEditLvlUp(ability, delta) {
    const char = this._editingChar;
    if (!char) return;
    
    if (!char.levelUpAttributes) {
      char.levelUpAttributes = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    }
    
    const totalLvlUp = Math.floor((char.level || 1) / 4);
    const allocatedLvlUp = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((acc, a) => acc + (char.levelUpAttributes?.[a] || 0), 0);
    const currentVal = char.levelUpAttributes[ability] || 0;
    
    if (delta > 0) {
      if (allocatedLvlUp >= totalLvlUp) {
        alert("Sem pontos de atributo disponíveis!");
        return;
      }
      char.levelUpAttributes[ability] = currentVal + 1;
    } else if (delta < 0) {
      if (currentVal <= 0) return;
      char.levelUpAttributes[ability] = currentVal - 1;
    }
    
    const newVal = char.levelUpAttributes[ability];
    const valEl = document.getElementById(`edit-lvlup-val-${ability}`);
    if (valEl) valEl.textContent = newVal;
    
    const newAllocated = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((acc, a) => acc + (char.levelUpAttributes?.[a] || 0), 0);
    const newAvailable = Math.max(0, totalLvlUp - newAllocated);
    
    const availEl = document.getElementById('edit-lvlup-available');
    if (availEl) availEl.textContent = newAvailable;
  }

  // MODALS CONTROL
  showModal() {
    const m = document.getElementById('modal-container');
    if (m) m.style.display = 'flex';
  }

  closeModal(event) {
    this.levelUpInProgress = false;
    const m = document.getElementById('modal-container');
    if (m) m.style.display = 'none';
  }

  showCustomAlert(message, onOk = null) {
    const modalBody = document.getElementById('modal-body-content');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1.5rem; font-family:var(--font-header); text-align: center; color: var(--accent-gold);">Mensagem do Sistema</h3>
      <p style="margin-bottom: 1.5rem; text-align: center; font-size: 1rem; color: var(--text-parchment); line-height: 1.5;">${message}</p>
      <div style="display:flex; justify-content:center;">
        <button class="rpg-btn" id="custom-alert-ok-btn" style="min-width: 100px; justify-content: center;">OK</button>
      </div>
    `;
    
    this.showModal();
    
    const okBtn = document.getElementById('custom-alert-ok-btn');
    if (okBtn) {
      okBtn.onclick = () => {
        this.closeModal();
        if (onOk) onOk();
      };
    }
  }

  showCustomConfirm(message, onConfirm) {
    const modalBody = document.getElementById('modal-body-content');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
      <h3 style="margin-bottom: 1.5rem; font-family:var(--font-header); text-align: center; color: var(--accent-gold);">Confirmação</h3>
      <p style="margin-bottom: 1.5rem; text-align: center; font-size: 1rem; color: var(--text-parchment); line-height: 1.5;">${message}</p>
      <div style="display:flex; justify-content:center; gap: 15px;">
        <button class="rpg-btn rpg-btn-secondary" id="custom-confirm-cancel-btn" style="min-width: 100px; justify-content: center;">Cancelar</button>
        <button class="rpg-btn" id="custom-confirm-ok-btn" style="min-width: 100px; justify-content: center;">Confirmar</button>
      </div>
    `;
    
    this.showModal();
    
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.closeModal();
      };
    }
    
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    if (okBtn) {
      okBtn.onclick = () => {
        this.closeModal();
        onConfirm();
      };
    }
  }

  logAction(actionText, customUser = null) {
    const username = customUser || (this.currentUser ? this.currentUser.username : 'Mestre/Visitante');
    const now = new Date();
    const timestamp = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

    if (this.firebaseInitialized && window.db) {
      const db = window.db;
      db.collection('logs').add({
        timestamp: timestamp,
        timestampRaw: firebase.firestore.FieldValue.serverTimestamp(),
        user: username,
        action: actionText
      }).catch(err => console.error("Erro ao gravar log: ", err));
    } else {
      const logs = JSON.parse(localStorage.getItem('dnd3_audit_logs')) || [];
      logs.unshift({
        timestamp: timestamp,
        user: username,
        action: actionText
      });
      if (logs.length > 200) {
        logs.pop();
      }
      localStorage.setItem('dnd3_audit_logs', JSON.stringify(logs));
    }
  }

  renderAuditLogs() {
    const container = document.getElementById('audit-log-list');
    if (!container) return;
    
    if (this.firebaseInitialized && window.db) {
      if (this.loadedLogs) {
        this.renderAuditLogsFromList(this.loadedLogs);
      } else {
        container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px; font-style: italic;">Carregando histórico...</div>`;
      }
    } else {
      const logs = JSON.parse(localStorage.getItem('dnd3_audit_logs')) || [];
      this.renderAuditLogsFromList(logs);
    }
  }

  renderAuditLogsFromList(logs) {
    const container = document.getElementById('audit-log-list');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px; font-style: italic;">Nenhum registro de alteração encontrado.</div>`;
      return;
    }
    
    container.innerHTML = logs.map(l => `
      <div class="audit-log-entry" style="padding: 10px; border-bottom: 1px solid rgba(212,175,55,0.1); display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; color: var(--accent-gold); font-size: 0.8rem;">
          <span><strong>Usuário:</strong> ${l.user}</span>
          <span>${l.timestamp}</span>
        </div>
        <div style="color: var(--text-light);">${l.action}</div>
      </div>
    `).join('');
  }

  clearAuditLogs() {
    this.showCustomConfirm("Deseja realmente limpar todo o histórico de alterações?", () => {
      if (this.firebaseInitialized && window.db) {
        const db = window.db;
        db.collection('logs').get().then(snapshot => {
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          return batch.commit();
        }).then(() => {
          this.showToast("Histórico de alterações limpo.");
        }).catch(err => {
          console.error("Erro ao limpar logs: ", err);
          this.showToast("Erro ao limpar histórico.");
        });
      } else {
        localStorage.removeItem('dnd3_audit_logs');
        this.renderAuditLogs();
        this.showToast("Histórico de alterações limpo.");
      }
    });
  }

  renderPlayerCombatTracker() {
    const container = document.getElementById('player-view-container');
    if (!container) return;

    const badge = document.getElementById('battlefield-mode-badge');
    if (badge) {
      badge.innerHTML = '<span style="color:var(--accent-gold); font-weight:bold;">Painel do Jogador</span>';
    }

    // Check if there is an active invite from the Master and we haven't responded 'accepted' yet
    if (this.inviteActive && this.currentUser) {
      const username = this.currentUser.username;
      const currentOwner = (username || '').toLowerCase();
      const myChars = this.savedCharacters.filter(c => c.owner && c.owner.toLowerCase() === currentOwner);
      const isCharInCombat = this.dmCombatants.some(c => c.type === 'player' && myChars.some(mc => mc.id === c.charId || (mc.name && mc.name.toLowerCase() === c.name.toLowerCase())));

      if (isCharInCombat) {
        if (!this.playerResponses) this.playerResponses = {};
        this.playerResponses[username] = 'accepted';
      }

      const response = this.playerResponses ? this.playerResponses[username] : undefined;
      
      // If we haven't accepted yet and are not in combat, show battle invite modal
      if (!isCharInCombat && response !== 'accepted') {
        const charOptionsHtml = myChars.map(c => `<option value="${c.id}">${c.name} (Nível ${c.level || 1})</option>`).join('');
        
        const monsters = this.dmCombatants.filter(c => c.type === 'npc');
        const monstersListHtml = monsters.map(m => `<li><strong>${m.name}</strong> (HP: ${m.maxHp} | CA: ${m.ac})</li>`).join('') 
          || `<li style="color:var(--text-muted);">Nenhum monstro definido ainda.</li>`;

        container.innerHTML = `
          <div id="player-battle-invite-modal" class="rpg-card" style="max-width: 550px; margin: 2rem auto; text-align: center; border: 2px solid var(--accent-gold); box-shadow: var(--shadow-premium); background: var(--bg-card);">
            <div style="font-size: 3.5rem; margin-bottom: 1rem; animation: pulse 2s infinite;">⚔️</div>
            <h2 style="color: var(--accent-gold); font-size: 1.8rem; margin-bottom: 1rem;">Convocação de Batalha!</h2>
            <p style="color: var(--text-parchment); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; font-family: var(--font-body);">
              O Mestre da Mesa está convocando os aventureiros para a batalha!
            </p>
            
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(234,179,8,0.2); border-radius: 8px; padding: 15px; margin-bottom: 1.5rem; text-align: left;">
              <div style="font-weight: bold; color: var(--accent-red); margin-bottom: 8px; font-family: var(--font-header); font-size: 0.9rem;">Ameaças Identificadas:</div>
              <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; color: var(--text-parchment);">
                ${monstersListHtml}
              </ul>
            </div>

            ${myChars.length === 0 ? `
              <div style="background: rgba(239,68,68,0.1); border: 1px solid var(--accent-red); padding: 10px; border-radius: 6px; color: var(--accent-red); font-size: 0.85rem; margin-bottom: 1.5rem; font-family: var(--font-body);">
                Você não tem personagens criados. Vá até a aba <strong>Fichas</strong> para criar sua ficha de personagem primeiro!
              </div>
              <button class="rpg-btn rpg-btn-secondary" style="border-color: var(--accent-red); color: var(--accent-red);" onclick="app.playerAcceptBattleInvite(false)">Recusar Convite</button>
            ` : `
              <div class="rpg-form-group" style="text-align: left; margin-bottom: 1.5rem;">
                <label class="rpg-label" style="font-size: 0.8rem;">Escolha seu Personagem para Entrar em Combate:</label>
                <select id="player-invite-char-select" class="rpg-select">
                  ${charOptionsHtml}
                </select>
              </div>
              <div style="display: flex; gap: 15px; justify-content: center;">
                <button class="rpg-btn" style="padding: 8px 25px; background: linear-gradient(135deg, var(--accent-gold), #854d0e);" onclick="app.playerAcceptInviteFromUI()">
                  Aceitar Desafio
                </button>
                <button class="rpg-btn rpg-btn-secondary" style="padding: 8px 25px; border-color: var(--accent-red); color: var(--accent-red);" onclick="app.playerAcceptBattleInvite(false)">
                  Recusar
                </button>
              </div>
            `}
          </div>
        `;
        return;
      }
    }

    if (this.dmCombatants.length === 0) {
      container.innerHTML = `
        <div class="rpg-card" style="text-align:center; padding: 2rem;">
          <h2>Painel de Combate</h2>
          <p style="color:var(--text-muted); margin-top:10px;">Nenhum combate em andamento no momento. Aguarde o Mestre iniciar o combate.</p>
        </div>
      `;
      return;
    }

    // Get current player's characters in combat
    const playerCombatants = this.dmCombatants.filter(c => c.type === 'player');
    
    // We filter characters owned by this player
    const currentOwner = this.normalizeRole(this.currentUser.username);
    const myChars = this.savedCharacters.filter(c => this.normalizeRole(c.owner) === currentOwner);
    const myCharsInCombat = playerCombatants.filter(pc => myChars.some(mc => mc.id === pc.charId));
    const myCharsNotInCombat = myChars.filter(mc => !playerCombatants.some(pc => pc.charId === mc.id));

    if (myCharsInCombat.length === 0) {
      container.innerHTML = `
        <div class="rpg-card" style="text-align:center; padding: 2rem; max-width: 500px; margin: 0 auto;">
          <h2>Painel de Combate</h2>
          <p style="color:var(--text-muted); margin-top:10px; margin-bottom: 20px;">Nenhum dos seus personagens está no combate atual.</p>
          ${myChars.length > 0 ? `
            <div style="background: rgba(0,0,0,0.25); padding: 15px; border-radius: 8px; border: 1px solid rgba(234,179,8,0.2); text-align: left;">
              <label class="rpg-label" style="font-size: 0.85rem; margin-bottom: 8px; display: block; text-align: center; color: var(--accent-gold);">Enviar Personagem para o Combate</label>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <select id="player-add-extra-char-select-empty" class="rpg-select" style="font-size: 0.85rem; width: 100%;">
                  ${myChars.map(c => `<option value="${c.id}">${c.name} (Lvl ${c.level || 1} ${window.DND3_Classes[c.class].name})</option>`).join('')}
                </select>
                <button class="rpg-btn" style="padding: 8px; font-size: 0.85rem; background: linear-gradient(135deg, var(--accent-gold), #854d0e); width: 100%;" onclick="app.playerAddExtraCharacterToBattleEmpty()">
                  ⚔️ Entrar na Batalha
                </button>
              </div>
            </div>
          ` : `
            <p style="color:var(--accent-red); font-size:0.85rem;">Você não possui nenhum personagem cadastrado. Crie um na aba "Criador de Personagem".</p>
          `}
        </div>
      `;
      return;
    }

    // Select active character (default to first one)
    if (!this.playerActiveCharId && myCharsInCombat.length > 0) {
      this.playerActiveCharId = myCharsInCombat[0].charId;
    }

    const activePC = myCharsInCombat.find(pc => pc.charId === this.playerActiveCharId) || myCharsInCombat[0];
    this.playerActiveCharId = activePC.charId;

    const charOptions = myCharsInCombat.map(pc => `
      <option value="${pc.charId}" ${pc.charId === this.playerActiveCharId ? 'selected' : ''}>${pc.name}</option>
    `).join('');

    // Target choices: group combatants into Enemies and Allies
    const enemies = this.dmCombatants.filter(c => c.type === 'npc');
    const allies = this.dmCombatants.filter(c => c.type === 'player');

    let targetOptions = '<option value="">-- Escolha um alvo --</option>';
    
    targetOptions += '<optgroup label="⚔️ Inimigos (Monstros)">';
    enemies.forEach(e => {
      const globalIdx = this.dmCombatants.indexOf(e);
      const dispName = this.getCombatantDisplayName(e);
      targetOptions += `<option value="enemy_${globalIdx}" ${this.playerSelectedTargetKey === `enemy_${globalIdx}` ? 'selected' : ''}>${dispName} (HP: ${e.currentHp}/${e.maxHp})</option>`;
    });
    targetOptions += '</optgroup>';

    targetOptions += '<optgroup label="🛡️ Aliados (Jogadores)">';
    allies.forEach(a => {
      const globalIdx = this.dmCombatants.indexOf(a);
      const isMe = a.charId === this.playerActiveCharId;
      targetOptions += `<option value="ally_${globalIdx}" ${this.playerSelectedTargetKey === `ally_${globalIdx}` ? 'selected' : ''}>${a.name} ${isMe ? '(Você)' : ''} (HP: ${a.currentHp}/${a.maxHp})</option>`;
    });
    targetOptions += '</optgroup>';

    // Determine target details if one is selected
    let targetDetailsHtml = "";
    if (this.playerSelectedTargetKey) {
      const [type, globalIdxStr] = this.playerSelectedTargetKey.split('_');
      const globalIdx = parseInt(globalIdxStr);
      const target = this.dmCombatants[globalIdx];

      if (target) {
        const isEnemy = target.type === 'npc';
        const dispName = isEnemy ? this.getCombatantDisplayName(target) : target.name;
        const isDefeated = target.currentHp <= 0;

        const imgUrl = target.avatar || (isEnemy ? this.getMonsterImageUrl(target.name) : 'rpg-icon.png');
        const filterStyle = target.avatar ? '' : (isEnemy ? this.getMonsterImageFilter(target.name) : '');
        const modifiedStats = isEnemy ? this.getModifiedMonsterStats(target) : { ac: target.ac, maxHp: target.maxHp, rm: target.rm || 0, saves: null };

        targetDetailsHtml = `
          <div class="rpg-card" style="margin-top: 15px; background: rgba(0,0,0,0.25); border: 1px solid rgba(212,175,55,0.3); padding: 15px; border-radius: 8px; display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
              <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">
                ${isEnemy ? `<span style="font-size:0.65rem; font-weight:bold; color:var(--accent-gold); background:rgba(0,0,0,0.4); padding:1px 4px; border-radius:3px; border:1px solid rgba(212,175,55,0.25);">Nvl ${target.level || target.baseHD || 1}</span>` : ''}
                <img src="${imgUrl}" style="width:68px; height:68px; object-fit:cover; border-radius:8px; border:2px solid ${isEnemy ? 'var(--accent-red)' : '#2ecc71'}; box-shadow:0 4px 10px rgba(0,0,0,0.4); ${filterStyle}" alt="${dispName}">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:160px; text-align:left;">
                <h3 style="color:${isEnemy ? '#ff4444' : '#2ecc71'}; font-size:1.1rem; margin:0; font-family:var(--font-header); display:flex; align-items:center; gap:6px;">
                  Alvo: ${dispName} ${isEnemy ? '👿' : '🛡️'}
                </h3>
                <div style="font-size:0.85rem; line-height:1.4;">
                  <strong>HP Atual:</strong> <span style="font-weight:bold; color:${target.currentHp <= 0 ? 'var(--accent-red)' : (isEnemy ? '#ff6666' : '#2ecc71')};">${target.currentHp}</span> / ${modifiedStats.maxHp}
                  ${target.conditions && target.conditions.length > 0 ? `<br><strong>Status Ativos:</strong> ${target.conditions.map(c => `<span class="condition-tag" style="font-size:0.7rem; padding:1px 4px; display:inline-block; margin-top:2px;">${c}</span>`).join(' ')}` : ''}
                </div>
              </div>
            </div>

            <!-- Action Forms -->
            <div style="display:flex; flex-direction:column; gap:10px; border-top:1px dashed rgba(234,179,8,0.15); padding-top:10px;">
              
              <!-- 1. Dano / Ataque (Para qualquer um, mas comum para inimigos) -->
              <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.05);">
                <label class="rpg-label" style="font-size:0.75rem; margin-bottom:4px; display:block;">⚔️ Causar Dano / Ataque</label>
                <div style="display:flex; gap:6px;">
                  <input type="number" id="player-dmg-input" class="rpg-input" placeholder="Dano" style="height:28px; font-size:0.8rem; flex:1; min-width:60px; text-align:center; padding:0 4px;" min="1">
                  <button class="rpg-btn" style="padding: 2px 10px; font-size: 0.75rem; height:28px; background:linear-gradient(135deg, var(--accent-red), #5a0000); text-transform:none;" onclick="app.playerApplyDamageToTarget(${globalIdx})">
                    Aplicar Dano
                  </button>
                </div>
              </div>

            </div>
          </div>
        `;
      }
    }

    // Generate compact square cards side by side
    const playerBattleCardsHtml = myCharsInCombat.map(pc => {
      const globalIdx = this.dmCombatants.indexOf(pc);
      const isActive = pc.charId === this.playerActiveCharId;
      const isDefeated = pc.currentHp <= 0;
      const cid = pc.charId;

      const deathClass = isDefeated ? ' card-defeated' : '';
      const skullOverlay = isDefeated ? '<div class="death-skull-overlay">💀</div>' : '';

      const borderStyle = isDefeated ? '' 
        : (isActive ? 'border: 2px solid var(--accent-gold); box-shadow: 0 0 12px rgba(234,179,8,0.5);' 
                    : 'border: 1px solid rgba(255,255,255,0.1);');

      // HP bar percentage
      const hpPct = pc.maxHp > 0 ? Math.max(0, Math.round((pc.currentHp / pc.maxHp) * 100)) : 0;
      const hpColor = hpPct > 60 ? '#2ecc71' : hpPct > 30 ? '#f39c12' : '#e74c3c';
      const hpTextColor = isDefeated ? 'var(--accent-red)' : hpColor;

      // Action dots
      const maxSlots = pc.actionsMax || this.getCombatantMaxActions(pc) || 1;
      const usedSlotsArr = pc.usedActionSlots || [];
      const actionDots = Array.from({ length: maxSlots }, (_, i) =>
        usedSlotsArr.includes(i) ? '🔴' : '🟢'
      ).join('');

      const activeLabel = isActive
        ? '<div style="font-size:0.6rem; background:var(--accent-gold); color:#000; border-radius:3px; padding:1px 5px; font-weight:bold; margin-top:2px; text-align:center;">ATIVO</div>'
        : '';

      return `
        <div class="character-battle-card${deathClass}" 
          style="position:relative; width:130px; min-height:110px; padding:10px 10px 8px; border-radius:10px; ${borderStyle} background:${isDefeated ? 'rgba(80,0,0,0.35)' : (isActive ? 'rgba(234,179,8,0.08)' : 'rgba(0,0,0,0.3)')}; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:6px; text-align:center; transition:var(--transition-smooth);"
          onclick="app.playerCombatSelectChar('${cid}')"
          title="${pc.name}">
          ${skullOverlay}

          <!-- Nome e Nível -->
          <div style="width:100%;">
            <div style="font-weight:bold; font-size:0.85rem; color:${isActive ? 'var(--accent-gold)' : '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${pc.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:1px;">Nível ${pc.level || 1}</div>
            ${activeLabel}
          </div>

          <!-- HP -->
          <div style="width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px;">
              <span style="font-size:0.65rem; color:var(--text-muted); font-weight:bold;">HP</span>
              <span style="font-size:0.9rem; font-weight:bold; color:${hpTextColor};">${pc.currentHp}<span style="font-size:0.65rem; color:var(--text-muted);">/${pc.maxHp}</span></span>
            </div>
            <div style="height:5px; border-radius:3px; background:rgba(255,255,255,0.08); overflow:hidden;">
              <div style="height:100%; width:${hpPct}%; background:${hpColor}; border-radius:3px; transition:width 0.4s ease;"></div>
            </div>
          </div>

          <!-- Ações (dots) e botões -->
          <div style="display:flex; flex-direction:column; align-items:center; gap:3px; width:100%;">
            <span style="font-size:0.8rem; letter-spacing:2px;">${actionDots}</span>
            <button type="button" class="rpg-btn" 
              style="width:100%; padding:2px 0; font-size:0.7rem; height:22px; background:linear-gradient(135deg,var(--accent-gold),#854d0e); border-color:var(--accent-gold); color:#111; font-weight:bold;"
              onclick="event.stopPropagation(); app.dmCombatantActionsModal(${globalIdx})"
              title="Ações de Combate">
              ⚔️ Ação
            </button>
            <div style="display:flex; gap:3px; width:100%; justify-content:center;">
              <button type="button" class="rpg-btn" style="flex:1; padding:1px 0; font-size:0.6rem; height:18px; line-height:1; background:linear-gradient(135deg, #374151, #1f2937); border-color:#6b7280; text-transform:none;" onclick="event.stopPropagation(); app.skipCombatantTurn(${globalIdx})" title="Pular Turno">⏭️ Pular</button>
              <button type="button" class="rpg-btn" style="flex:1; padding:1px 0; font-size:0.6rem; height:18px; line-height:1; background:linear-gradient(135deg, #475569, #334155); border-color:#94a3b8; text-transform:none;" onclick="event.stopPropagation(); app.actLastCombatant(${globalIdx})" title="Agir por Último">⏳ Último</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="grid-2" style="margin-top: 15px;">
        <!-- Left: Player Info -->
        <div class="rpg-card" style="display: flex; flex-direction: column; gap: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(170,124,17,0.15); padding-bottom: 8px; margin-bottom: 5px; flex-wrap: wrap; gap: 6px;">
            <h2 style="margin:0;">Seus Personagens em Batalha</h2>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="rpg-btn" style="background: linear-gradient(135deg, #10b981, #047857); border-color: #059669; color: #fff; padding: 4px 10px; font-size: 0.75rem; font-weight: bold;" onclick="app.playerOpenResurrectModal()">
                ✨ Ressuscitar Personagem
              </button>
              <button class="rpg-btn" style="background: linear-gradient(135deg, #a00, #500); border-color: #800; color: #fff; padding: 4px 10px; font-size: 0.75rem;" onclick="app.playerExitBattle()">
                🚪 Sair da Batalha
              </button>
            </div>
          </div>
          
          <div style="display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0;">
            ${playerBattleCardsHtml}
          </div>

          ${myCharsNotInCombat.length > 0 ? `
            <div style="margin-top: 5px; padding: 12px; background: rgba(0,0,0,0.2); border: 1px dashed rgba(234,179,8,0.25); border-radius: 6px;">
              <label class="rpg-label" style="font-size: 0.8rem; margin-bottom: 6px; display: block; color: var(--accent-gold);">Enviar outro Personagem para a Batalha:</label>
              <div style="display: flex; gap: 8px;">
                <select id="player-add-extra-char-select" class="rpg-select" style="font-size: 0.8rem; height: 32px; flex: 1;">
                  ${myCharsNotInCombat.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
                <button class="rpg-btn" style="padding: 2px 12px; font-size: 0.8rem; height: 32px; background: linear-gradient(135deg, var(--accent-gold), #854d0e);" onclick="app.playerAddExtraCharacterToBattle()">
                  Entrar
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Right: Target & Attack -->
        <div class="rpg-card">
          <h2>Escolha um Alvo na Batalha</h2>
          <div class="rpg-form-group" style="margin-top:15px;">
            <label class="rpg-label">Selecionar Alvo (Aliado ou Inimigo)</label>
            <select id="player-target-select" class="rpg-select" onchange="app.playerCombatSelectTarget(this.value)">
              ${targetOptions}
            </select>
          </div>

          <div id="player-target-details-area">
            ${targetDetailsHtml}
          </div>
        </div>
      </div>
    `;
  }

  playerAddExtraCharacterToBattle() {
    const select = document.getElementById('player-add-extra-char-select');
    if (!select || !select.value) return;
    this.playerAcceptBattleInvite(select.value);
  }

  playerAddExtraCharacterToBattleEmpty() {
    const select = document.getElementById('player-add-extra-char-select-empty');
    if (!select || !select.value) return;
    this.playerAcceptBattleInvite(select.value);
  }

  playerExitBattle() {
    if (!this.currentUser) return;
    const currentOwner = this.normalizeRole(this.currentUser.username);
    const myChars = this.savedCharacters.filter(c => this.normalizeRole(c.owner) === currentOwner);
    const myCharIds = myChars.map(c => c.id);

    // Remove characters from combat
    this.dmCombatants = this.dmCombatants.filter(c => !myCharIds.includes(c.charId));

    if (this.playerResponses) {
      delete this.playerResponses[this.currentUser.username];
    }

    this.playerActiveCharId = null;
    this.playerSelectedTargetKey = null;

    this.saveCombatState();
    this.playSound('click');
    this.showToast("Você saiu da batalha.");

    // Redirect to welcome tab
    this.switchTab('welcome');
  }

  playerOpenResurrectModal() {
    if (!this.dmCombatants || this.dmCombatants.length === 0) {
      this.showToast("Nenhum combate ativo no momento.");
      return;
    }

    // Identify defeated or dead characters in combat
    const deadCombatants = this.dmCombatants.filter(c => c.currentHp <= 0 || (c.conditions && c.conditions.includes('Morto')));
    const allCombatants = this.dmCombatants;

    const listToChoose = deadCombatants.length > 0 ? deadCombatants : allCombatants;
    
    // Check if there is a Cleric in combat or in saved characters
    const clericsInCombat = this.dmCombatants.filter(c => {
      const cls = (c.class || '').toLowerCase();
      return cls.includes('cleric') || cls.includes('clérigo') || cls.includes('clerigo');
    });

    const clericsInSaved = this.savedCharacters.filter(c => {
      const cls = (c.class || '').toLowerCase();
      return cls.includes('cleric') || cls.includes('clérigo') || cls.includes('clerigo');
    });

    let clericInfoHtml = '';
    let clericSpellName = 'Reviver os Mortos / Ressurreição';

    if (clericsInCombat.length > 0 || clericsInSaved.length > 0) {
      const clericObj = clericsInCombat[0] || clericsInSaved[0];
      const lvl = clericObj.level || 9;
      if (lvl >= 17) clericSpellName = 'Ressurreição Verdadeira (PV Total)';
      else if (lvl >= 13) clericSpellName = 'Ressurreição (PV Total)';
      else clericSpellName = 'Reviver os Mortos (1 PV / Nível)';

      clericInfoHtml = `
        <div style="background: rgba(16,185,129,0.12); border: 1px solid #10b981; padding: 10px; border-radius: 6px; font-size: 0.8rem; color: #a7f3d0; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div>
            <strong>✨ Clérigo no Grupo:</strong> ${clericObj.name} (Nível ${lvl})<br>
            <span style="font-size: 0.75rem; color: #d1fae5;">Magia: ${clericSpellName}</span>
          </div>
          <button type="button" class="rpg-btn" style="padding: 4px 8px; font-size: 0.72rem; background: linear-gradient(135deg, #10b981, #047857); border-color: #059669; white-space: nowrap;" onclick="app.autofillClericResurrect(${lvl})">
            🔮 Usar Magia do Clérigo
          </button>
        </div>
      `;
    } else {
      clericInfoHtml = `
        <div style="background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); padding: 8px 10px; border-radius: 6px; font-size: 0.78rem; color: var(--accent-gold); margin-bottom: 12px;">
          ℹ️ Nenhum Clérigo detectado no grupo. Digite o valor de HP desejado para a ressurreição.
        </div>
      `;
    }

    const optionsHtml = listToChoose.map(c => {
      const idx = this.dmCombatants.indexOf(c);
      const isDead = c.currentHp <= 0;
      return `<option value="${idx}">${c.name} ${isDead ? '💀 [Derrotado/Morto]' : '(HP: ' + c.currentHp + '/' + c.maxHp + ')'}</option>`;
    }).join('');

    const modalContent = `
      <div style="text-align: left; padding: 5px;">
        <h2 style="color: var(--accent-gold); font-size: 1.3rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          ✨ Ressuscitar Personagem
        </h2>

        ${clericInfoHtml}

        <div class="rpg-form-group" style="margin-bottom: 12px;">
          <label class="rpg-label" style="font-size: 0.8rem;">Selecione o Personagem:</label>
          <select id="resurrect-target-select" class="rpg-select" style="font-size: 0.85rem;" onchange="app.onResurrectTargetChange(this.value)">
            ${optionsHtml}
          </select>
        </div>

        <div class="rpg-form-group" style="margin-bottom: 15px;">
          <label class="rpg-label" style="font-size: 0.8rem;">Quantidade de HP após Ressuscitar:</label>
          <input type="number" id="resurrect-hp-input" class="rpg-input" value="10" min="1" placeholder="Digite os PVs com que vai retornar" style="font-size: 0.9rem; text-align: center; height: 36px;">
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; border-top: 1px solid rgba(170,124,17,0.15); padding-top: 12px;">
          <button type="button" class="rpg-btn" style="padding: 6px 16px; font-size: 0.82rem; background: linear-gradient(135deg, #10b981, #047857); border-color: #059669;" onclick="app.confirmResurrection()">
            ✨ Confirmar Ressurreição
          </button>
          <button type="button" class="rpg-btn rpg-btn-secondary" style="padding: 6px 16px; font-size: 0.82rem;" onclick="app.closeModal()">
            Cancelar
          </button>
        </div>
      </div>
    `;

    const modalBody = document.getElementById('modal-body-content');
    if (modalBody) {
      modalBody.innerHTML = modalContent;
      this.showModal();
      this.onResurrectTargetChange(document.getElementById('resurrect-target-select')?.value || 0);
    }
  }

  onResurrectTargetChange(idxStr) {
    const idx = parseInt(idxStr);
    const c = this.dmCombatants[idx];
    const hpInput = document.getElementById('resurrect-hp-input');
    if (c && hpInput) {
      hpInput.value = c.maxHp || 10;
    }
  }

  autofillClericResurrect(clericLvl) {
    const hpInput = document.getElementById('resurrect-hp-input');
    const selectEl = document.getElementById('resurrect-target-select');
    if (!hpInput || !selectEl) return;

    const idx = parseInt(selectEl.value);
    const c = this.dmCombatants[idx];
    if (c) {
      if (clericLvl >= 13) {
        hpInput.value = c.maxHp || 20;
      } else {
        const targetLvl = c.level || 1;
        hpInput.value = Math.max(1, targetLvl * 1);
      }
      this.showToast("HP preenchido com base na Magia de Ressurreição do Clérigo!");
    }
  }

  confirmResurrection() {
    const selectEl = document.getElementById('resurrect-target-select');
    const hpInput = document.getElementById('resurrect-hp-input');
    if (!selectEl || !hpInput) return;

    const idx = parseInt(selectEl.value);
    const hpVal = Math.max(1, parseInt(hpInput.value) || 1);

    const c = this.dmCombatants[idx];
    if (!c) return;

    c.currentHp = hpVal;
    c.finishedTurn = false;
    c.actLast = false;
    c.actionsUsed = 0;
    c.usedActionSlots = [];

    if (Array.isArray(c.conditions)) {
      c.conditions = c.conditions.filter(cond => cond !== 'Morto' && cond !== 'Inconsciente' && cond !== 'Caído');
    }

    if (c.type === 'player' && c.charId) {
      const char = this.savedCharacters.find(sc => sc.id === c.charId);
      if (char) {
        char.currentHp = hpVal;
        this.saveCharactersState();
      }
    }

    this.lastResurrectEvent = { charName: c.name, hp: hpVal, time: Date.now() };
    this.autoSortInitiative();
    this.saveCombatState();
    this.logAction(`✨ ${c.name} foi ressuscitado com ${hpVal} PV!`);

    this.triggerAngelResurrectAnimation(c.name, hpVal);
    this.showToast(`✨ ${c.name} foi ressuscitado com ${hpVal} PV!`);
    this.closeModal();
    this.renderDMCombatTracker();
    this.renderPlayerCombatTracker();
  }

  triggerAngelResurrectAnimation(charName, hpRestored) {
    let overlay = document.getElementById('angel-resurrect-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'angel-resurrect-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, rgba(245, 158, 11, 0.4) 0%, rgba(0, 0, 0, 0.88) 75%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes floatHalo {
          0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 0 25px #f59e0b, inset 0 0 15px #fef08a; }
          50% { transform: translateY(-10px) scale(1.08); box-shadow: 0 0 40px #f59e0b, inset 0 0 25px #fff; }
        }
        @keyframes flapWingLeft {
          0% { transform: scale(0.2) rotate(-40deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(12deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes flapWingRight {
          0% { transform: scale(0.2) rotate(40deg) scaleX(-1); opacity: 0; }
          60% { transform: scale(1.2) rotate(-12deg) scaleX(-1); opacity: 1; }
          100% { transform: scale(1) rotate(0deg) scaleX(-1); opacity: 1; }
        }
        @keyframes floatSparkle {
          0% { transform: translateY(20px) scale(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-70px) scale(1.3); opacity: 0; }
        }
        @keyframes divineGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(245, 158, 11, 0.8)); }
          50% { filter: drop-shadow(0 0 45px rgba(254, 240, 138, 1)); }
        }
      </style>

      <div style="position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; animation: divineGlowPulse 2.2s infinite ease-in-out;">
        <!-- Glowing Halo (Auréola Divina) -->
        <div style="
          width: 100px;
          height: 26px;
          border: 4px solid #fef08a;
          border-radius: 50%;
          animation: floatHalo 2.5s infinite ease-in-out;
          margin-bottom: -18px;
          z-index: 10;
          background: rgba(254, 240, 138, 0.25);
        "></div>

        <!-- Asas de Anjo (Wings) & Efeitos -->
        <div style="position:relative; display:flex; align-items:center; justify-content:center; margin-bottom:15px;">
          <!-- Asa Esquerda -->
          <svg style="width:150px; height:130px; animation: flapWingLeft 1.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;" viewBox="0 0 100 100" fill="none">
            <path d="M90 80 C80 40, 50 10, 10 20 C20 40, 40 60, 60 70 C70 75, 80 80, 90 80 Z" fill="url(#wingGradL)" filter="drop-shadow(0 0 12px #f59e0b)"/>
            <path d="M85 75 C70 45, 45 25, 15 30 C30 45, 50 60, 85 75 Z" fill="#fff" opacity="0.75"/>
            <defs>
              <linearGradient id="wingGradL" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="50%" stop-color="#fef08a"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>

          <!-- Centro Sagrado -->
          <div style="font-size: 3.8rem; margin: 0 -20px; z-index: 5; text-shadow: 0 0 30px #f59e0b;">✨</div>

          <!-- Asa Direita -->
          <svg style="width:150px; height:130px; animation: flapWingRight 1.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;" viewBox="0 0 100 100" fill="none">
            <path d="M90 80 C80 40, 50 10, 10 20 C20 40, 40 60, 60 70 C70 75, 80 80, 90 80 Z" fill="url(#wingGradR)" filter="drop-shadow(0 0 12px #f59e0b)"/>
            <path d="M85 75 C70 45, 45 25, 15 30 C30 45, 50 60, 85 75 Z" fill="#fff" opacity="0.75"/>
            <defs>
              <linearGradient id="wingGradR" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="50%" stop-color="#fef08a"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <!-- Banner com Nome do Personagem -->
        <div style="text-align:center; background: rgba(0,0,0,0.85); border: 2px solid #fef08a; padding: 14px 28px; border-radius: 14px; box-shadow: 0 0 35px rgba(245, 158, 11, 0.7); backdrop-filter: blur(4px);">
          <div style="font-family: var(--font-header); font-size: 1.3rem; color: #fef08a; text-shadow: 0 0 15px #f59e0b; letter-spacing: 2px;">✨ Você foi Ressuscitado ✨</div>
          <div style="font-size: 1.25rem; color: #fff; font-weight: bold; margin-top: 6px;">${charName}</div>
          <div style="font-size: 0.9rem; color: #2ecc71; margin-top: 3px; font-weight: bold;">Ressuscitado com ${hpRestored} PV!</div>
        </div>

        <!-- Partículas de Luz Flutuantes -->
        <div style="position:absolute; width:100%; height:100%; pointer-events:none;">
          <span style="position:absolute; left:12%; top:15%; font-size:1.4rem; animation: floatSparkle 2s infinite ease-out;">🌟</span>
          <span style="position:absolute; right:15%; top:20%; font-size:1.1rem; animation: floatSparkle 2.4s infinite ease-out 0.4s;">✨</span>
          <span style="position:absolute; left:25%; top:65%; font-size:1.5rem; animation: floatSparkle 2.1s infinite ease-out 0.7s;">✨</span>
          <span style="position:absolute; right:22%; top:60%; font-size:1.2rem; animation: floatSparkle 1.8s infinite ease-out 0.3s;">🌟</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    }, 3500);
  }

  triggerDefeatedAnimation(charName) {
    let overlay = document.getElementById('defeated-overlay');
    if (overlay) overlay.remove();

    if (typeof this.playSound === 'function') {
      try { this.playSound('defeat'); } catch(e) {}
    }

    overlay = document.createElement('div');
    overlay.id = 'defeated-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, rgba(160, 0, 0, 0.65) 0%, rgba(10, 0, 0, 0.95) 75%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes skullPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 30px #ef4444); }
          50% { transform: scale(1.16); filter: drop-shadow(0 0 60px #dc2626); }
        }
        @keyframes crossedBonesAppear {
          0% { transform: scale(0.2) rotate(-90deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes floatAsh {
          0% { transform: translateY(30px) scale(0.8) rotate(0deg); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(-90px) scale(1.2) rotate(180deg); opacity: 0; }
        }
        @keyframes deathGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 25px rgba(220, 38, 38, 0.8)); }
          50% { filter: drop-shadow(0 0 50px rgba(239, 68, 68, 1)); }
        }
      </style>

      <div style="position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; animation: deathGlowPulse 2s infinite ease-in-out;">
        
        <!-- Ossos Cruzados em X & Caveira Central (Sem Asas) -->
        <div style="position:relative; display:flex; align-items:center; justify-content:center; margin-bottom:20px; width:220px; height:220px;">
          <!-- SVG dos Ossos Cruzados em X -->
          <svg style="width:220px; height:220px; position:absolute; z-index:4; animation: crossedBonesAppear 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;" viewBox="0 0 100 100" fill="none">
            <filter id="boneGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#dc2626"/>
            </filter>
            <!-- Osso 1 (Haste Diagonal \) -->
            <g filter="url(#boneGlow)">
              <rect x="46" y="10" width="8" height="80" rx="4" transform="rotate(-45 50 50)" fill="#e2e8f0"/>
              <!-- Cabeças do Osso 1 -->
              <circle cx="20" cy="20" r="7" fill="#cbd5e1"/>
              <circle cx="24" cy="15" r="7" fill="#f1f5f9"/>
              <circle cx="80" cy="80" r="7" fill="#cbd5e1"/>
              <circle cx="76" cy="85" r="7" fill="#f1f5f9"/>
            </g>
            <!-- Osso 2 (Haste Diagonal /) -->
            <g filter="url(#boneGlow)">
              <rect x="46" y="10" width="8" height="80" rx="4" transform="rotate(45 50 50)" fill="#e2e8f0"/>
              <!-- Cabeças do Osso 2 -->
              <circle cx="80" cy="20" r="7" fill="#cbd5e1"/>
              <circle cx="76" cy="15" r="7" fill="#f1f5f9"/>
              <circle cx="20" cy="80" r="7" fill="#cbd5e1"/>
              <circle cx="24" cy="85" r="7" fill="#f1f5f9"/>
            </g>
          </svg>

          <!-- Caveira Sombria no Meio dos Ossos -->
          <div style="font-size: 5.5rem; z-index: 6; text-shadow: 0 0 40px #dc2626, 0 0 80px #7f1d1d; animation: skullPulse 2s infinite ease-in-out;">💀</div>
        </div>

        <!-- Banner com Nome do Personagem Derrotado/Morto -->
        <div style="text-align:center; background: rgba(15, 0, 0, 0.92); border: 2px solid #ef4444; padding: 16px 36px; border-radius: 14px; box-shadow: 0 0 45px rgba(220, 38, 38, 0.85); backdrop-filter: blur(5px);">
          <div style="font-family: var(--font-header); font-size: 1.4rem; color: #fca5a5; text-shadow: 0 0 18px #dc2626; letter-spacing: 3px; font-weight: 800;">☠️ O Personagem Caiu em Batalha ☠️</div>
          <div style="font-size: 1.35rem; color: #fff; font-weight: bold; margin-top: 6px;">${charName}</div>
          <div style="font-size: 0.9rem; color: #ef4444; margin-top: 4px; font-weight: bold;">Derrotado (0 PV) · A morte o reivindicou</div>
        </div>

        <!-- Partículas de Cinza, Brasas e Caveiras Flutuantes -->
        <div style="position:absolute; width:100%; height:100%; pointer-events:none;">
          <span style="position:absolute; left:12%; top:20%; font-size:1.4rem; animation: floatAsh 2.2s infinite ease-out;">🔥</span>
          <span style="position:absolute; right:15%; top:25%; font-size:1.2rem; animation: floatAsh 2.5s infinite ease-out 0.4s;">☠️</span>
          <span style="position:absolute; left:25%; top:65%; font-size:1.5rem; animation: floatAsh 2.1s infinite ease-out 0.7s;">🥀</span>
          <span style="position:absolute; right:22%; top:60%; font-size:1.3rem; animation: floatAsh 1.9s infinite ease-out 0.3s;">🔥</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    }, 3500);
  }

  dmRollInitiativeFor(idx) {
    const combatant = this.dmCombatants[idx];
    if (!combatant) return;
    const initMod = parseInt(combatant.initMod) || 0;
    const roll = Math.floor(Math.random() * 10) + 1;
    combatant.initRoll = roll + initMod;
    this.playSound('click');
    const modStr = initMod >= 0 ? `+ ${initMod}` : `- ${Math.abs(initMod)}`;
    this.showToast(`Iniciativa rolada para ${combatant.name}: ${combatant.initRoll} (${roll} ${modStr})`);
    this.saveCombatState();
    
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }
  }

  playerRollInitiative() {
    this.playerRollInitiativeFor(this.playerActiveCharId);
  }

  playerRollInitiativeFor(charId) {
    console.log('[playerRollInitiativeFor] called with charId:', charId, '| dmCombatants count:', this.dmCombatants.length);
    // Try matching by charId (string comparison)
    let pcIdx = this.dmCombatants.findIndex(c => c.charId === charId && c.type === 'player');
    // Fallback: loose match in case of type coercion
    if (pcIdx === -1) pcIdx = this.dmCombatants.findIndex(c => String(c.charId) === String(charId) && c.type === 'player');
    if (pcIdx === -1) {
      console.warn('[playerRollInitiativeFor] Combatant not found for charId:', charId);
      this.showToast('Erro: personagem não encontrado no combate. Recarregue a página.');
      return;
    }
    const combatant = this.dmCombatants[pcIdx];
    const initMod = parseInt(combatant.initMod) || 0;
    const roll = Math.floor(Math.random() * 10) + 1;
    combatant.initRoll = roll + initMod;
    this.playSound('click');
    const modStr = initMod >= 0 ? `+ ${initMod}` : `- ${Math.abs(initMod)}`;
    this.showToast(`Você rolou iniciativa para ${combatant.name}: ${combatant.initRoll} (${roll} ${modStr})`);
    this.saveCombatState();
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }
  }

  playerSaveInitiative(charId, val) {
    let pcIdx = this.dmCombatants.findIndex(c => c.charId === charId && c.type === 'player');
    if (pcIdx === -1) pcIdx = this.dmCombatants.findIndex(c => String(c.charId) === String(charId) && c.type === 'player');
    if (pcIdx === -1) {
      console.warn('[playerSaveInitiative] Combatant not found for charId:', charId);
      this.showToast('Erro: personagem não encontrado no combate. Recarregue a página.');
      return;
    }
    const combatant = this.dmCombatants[pcIdx];
    combatant.initRoll = val !== '' ? parseInt(val) || 0 : '';
    this.saveCombatState();
    this.showToast(`Iniciativa de ${combatant.name} salva.`);
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }
  }

  playerClearInitiative(charId) {
    let pcIdx = this.dmCombatants.findIndex(c => c.charId === charId && c.type === 'player');
    if (pcIdx === -1) pcIdx = this.dmCombatants.findIndex(c => String(c.charId) === String(charId) && c.type === 'player');
    if (pcIdx === -1) {
      console.warn('[playerClearInitiative] Combatant not found for charId:', charId);
      this.showToast('Erro: personagem não encontrado no combate. Recarregue a página.');
      return;
    }
    const combatant = this.dmCombatants[pcIdx];
    combatant.initRoll = '';
    this.saveCombatState();
    this.showToast(`Iniciativa de ${combatant.name} apagada.`);
    const shouldRenderDmView = this.currentUser && ['dm', 'admin'].includes(this.normalizeRole(this.currentUser.role));
    if (shouldRenderDmView) {
      this.renderDMCombatTracker();
    } else {
      this.renderPlayerCombatTracker();
    }
  }

  playerApplyDamageToTarget(globalIdx) {
    const target = this.dmCombatants[globalIdx];
    if (!target) return;

    const dmgInput = document.getElementById('player-dmg-input');
    const dmg = parseInt(dmgInput?.value) || 0;
    if (dmg <= 0) {
      alert("Por favor, insira um valor de dano válido.");
      return;
    }

    const wasAlreadyDefeated = target.currentHp <= 0;

    target.currentHp -= dmg;
    if (target.currentHp < -10) target.currentHp = -10;

    const activePC = this.dmCombatants.find(c => c.charId === this.playerActiveCharId && c.type === 'player');
    const attackerKey = activePC ? `${activePC.name} (${this.currentUser.username})` : this.currentUser.username;

    if (target.type === 'npc') {
      if (!target.damageByPlayer) target.damageByPlayer = {};
      target.damageByPlayer[attackerKey] = (target.damageByPlayer[attackerKey] || 0) + dmg;
    }

    // Play damage sound and show floating numbers
    this.playSound('damage');
    const activeView = document.getElementById('player-view-container');
    if (activeView) {
      this.showFloatingDamage(activeView, dmg, false);
    }

    this.saveCombatState();

    const actorName = activePC ? activePC.name : this.currentUser.username;
    const dispName = target.type === 'npc' ? this.getCombatantDisplayName(target) : target.name;
    this.logAction(`${actorName} causou ${dmg} de dano em ${dispName}.`);

    // Check if defeated now
    if (target.currentHp <= 0 && !wasAlreadyDefeated) {
      const charName = dispName || target.name;
      this.lastDefeatedEvent = { charName: charName, time: Date.now() };
      this.triggerDefeatedAnimation(charName);
      this.playSound('victory');
      this.showToast(`☠️ Oponente derrotado: ${charName}!`);
    }

    this.renderPlayerCombatTracker();
  }

  playerApplyHealToTarget(globalIdx) {
    const target = this.dmCombatants[globalIdx];
    if (!target) return;

    const healInput = document.getElementById('player-heal-input');
    const heal = parseInt(healInput?.value) || 0;
    if (heal <= 0) {
      alert("Por favor, insira um valor de cura válido.");
      return;
    }

    target.currentHp = Math.min(target.maxHp, target.currentHp + heal);

    // Play heal sound and show floating numbers
    this.playSound('heal');
    const activeView = document.getElementById('player-view-container');
    if (activeView) {
      this.showFloatingDamage(activeView, heal, true);
    }

    this.saveCombatState();

    const activePC = this.dmCombatants.find(c => c.charId === this.playerActiveCharId && c.type === 'player');
    const actorName = activePC ? activePC.name : this.currentUser.username;
    const dispName = target.type === 'npc' ? this.getCombatantDisplayName(target) : target.name;
    this.logAction(`${actorName} curou ${heal} HP de ${dispName}.`);
    this.showToast(`Cura aplicada a ${dispName}: +${heal} HP`);

    this.renderPlayerCombatTracker();
  }

  playerApplyEffectToTarget(globalIdx) {
    const target = this.dmCombatants[globalIdx];
    if (!target) return;

    const select = document.getElementById('player-effect-select');
    const effect = select?.value;
    if (!effect) return;

    if (!target.conditions) target.conditions = [];
    if (!target.conditions.includes(effect)) {
      target.conditions.push(effect);
      this.playSound('click');
      
      const dispName = target.type === 'npc' ? this.getCombatantDisplayName(target) : target.name;
      this.logAction(`Jogador ${this.currentUser.username} aplicou o efeito "${effect}" em ${dispName}.`);
      this.showToast(`Efeito "${effect}" aplicado a ${dispName}!`);
      
      this.saveCombatState();
      this.renderPlayerCombatTracker();
    } else {
      const dispName = target.type === 'npc' ? this.getCombatantDisplayName(target) : target.name;
      alert(`O alvo ${dispName} já possui a condição "${effect}".`);
    }
  }

  playerRemoveEffectFromTarget(globalIdx, effectIdx) {
    const target = this.dmCombatants[globalIdx];
    if (!target || !target.conditions) return;

    const effect = target.conditions[effectIdx];
    target.conditions.splice(effectIdx, 1);
    this.playSound('click');

    const dispName = target.type === 'npc' ? this.getCombatantDisplayName(target) : target.name;
    this.logAction(`Jogador ${this.currentUser.username} removeu o efeito "${effect}" de ${dispName}.`);
    this.showToast(`Efeito "${effect}" removido de ${dispName}.`);

    this.saveCombatState();
    this.renderPlayerCombatTracker();
  }

  playerCombatSelectChar(charId) {
    this.playerActiveCharId = charId;
    this.renderPlayerCombatTracker();
  }

  playerCombatSelectTarget(targetKey) {
    this.playerSelectedTargetKey = targetKey;
    this.renderPlayerCombatTracker();
  }

  playerAcceptInviteFromUI() {
    const select = document.getElementById('player-invite-char-select');
    if (!select) return;
    const charId = select.value;
    if (!charId) return;
    
    // Set the selected character as active and accept the invite
    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;
    
    const stats = this.calculateActiveStats(char);
    const alreadyIn = this.dmCombatants.some(c => c.charId === char.id);
    if (!alreadyIn) {
      this.dmCombatants.push({
        charId: char.id,
        name: char.name,
        type: "player",
        maxHp: stats.maxHp,
        currentHp: char.currentHp || stats.maxHp,
        ac: stats.ac,
        initMod: stats.initiative || 0,
        initRoll: null, // player will roll manually
        conditions: []
      });
    }

    if (!this.playerResponses) this.playerResponses = {};
    this.playerResponses[this.currentUser.username] = 'accepted';
    this.playerActiveCharId = char.id;
    this.playSound('victory');
    this.logAction(`Jogador ${this.currentUser.username} aceitou o convite com ${char.name} e entrou na batalha!`);
    this.showToast("Você entrou na batalha!");
    this.saveCombatState();
    this.renderPlayerCombatTracker();
  }

  playerAcceptBattleInvite(accepted) {
    if (!this.currentUser) return;
    const username = this.currentUser.username;
    
    if (!this.playerResponses) this.playerResponses = {};

    if (accepted) {
      // Find player's character(s)
      const normalizedPlayerOwner = this.normalizeRole(username);
      const myChars = this.savedCharacters.filter(c => this.normalizeRole(c.owner) === normalizedPlayerOwner);
      if (myChars.length === 0) {
        alert("Você precisa criar um personagem na aba 'Fichas' antes de entrar na batalha!");
        this.playerResponses[username] = 'declined';
        this.saveCombatState();
        this.renderPlayerCombatTracker();
        return;
      }
      
      // Add first character to combat if not already in
      let char = myChars[0];
      if (typeof accepted === 'string' && accepted !== 'accepted') {
        const selectedChar = myChars.find(c => c.id === accepted);
        if (selectedChar) char = selectedChar;
      }
      const alreadyIn = this.dmCombatants.some(c => c.charId === char.id);
      if (!alreadyIn) {
        const stats = this.calculateActiveStats(char);
        this.dmCombatants.push({
          charId: char.id,
          name: char.name,
          type: "player",
          level: char.level || 1,
          class: char.class || 'fighter',
          actionsMax: this.getCombatantMaxActions(char),
          actionsUsed: 0,
          maxHp: stats.maxHp,
          currentHp: char.currentHp || stats.maxHp,
          ac: stats.ac,
          initMod: stats.initiative || 0,
          initRoll: null, // player will roll manually
          conditions: []
        });
      }
      
      this.playerResponses[username] = 'accepted';
      this.playSound('victory');
      this.logAction(`Jogador ${username} aceitou o convite com ${char.name} e entrou na batalha!`);
      this.showToast("Você entrou na batalha!");
    } else {
      this.playerResponses[username] = 'declined';
      this.playSound('click');
      this.logAction(`Jogador ${username} recusou o convite de batalha.`);
      this.showToast("Convite recusado.");
    }
    
    this.saveCombatState();
    this.renderPlayerCombatTracker();
    this.renderGlobalBattleInviteModal();
  }

  renderGlobalBattleInviteModal() {
    let overlay = document.getElementById('global-battle-invite-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-battle-invite-overlay';
      overlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:99999; align-items:center; justify-content:center; padding:15px; box-sizing:border-box;';
      document.body.appendChild(overlay);
    }

    if (!this.currentUser) {
      overlay.style.display = 'none';
      return;
    }

    const username = this.currentUser.username;
    const currentOwner = (username || '').toLowerCase();
    const isPlayer = this.normalizeRole(this.currentUser.role) === 'player';
    
    // Only show to Players
    if (!isPlayer) {
      overlay.style.display = 'none';
      return;
    }

    const myChars = this.savedCharacters.filter(c => c.owner && c.owner.toLowerCase() === currentOwner);
    const isCharInCombat = this.dmCombatants.some(c => c.type === 'player' && (
      (c.charId && myChars.some(mc => mc.id === c.charId)) ||
      (c.name && myChars.some(mc => mc.name.toLowerCase() === c.name.toLowerCase())) ||
      (c.name && c.owner && c.owner.toLowerCase() === currentOwner)
    ));

    if (isCharInCombat) {
      if (!this.playerResponses) this.playerResponses = {};
      this.playerResponses[username] = 'accepted';
    }

    const response = this.playerResponses ? this.playerResponses[username] : undefined;

    if (this.inviteActive && !isCharInCombat && response !== 'accepted') {
      const charOptionsHtml = myChars.map(c => `<option value="${c.id}">${c.name} (Nível ${c.level || 1})</option>`).join('');
      
      const monsters = this.dmCombatants.filter(c => c.type === 'npc');
      const monstersListHtml = monsters.map(m => `<li><strong>${m.name}</strong> (HP: ${m.maxHp} | CA: ${m.ac})</li>`).join('') 
        || `<li style="color:var(--text-muted);">Nenhum monstro definido ainda.</li>`;

      overlay.innerHTML = `
        <div class="rpg-card" style="max-width: 500px; width: 100%; text-align: center; border: 2px solid var(--accent-gold); box-shadow: 0 0 35px rgba(234,179,8,0.5); background: var(--bg-card); animation: fadeIn 0.3s ease-out;">
          <div style="font-size: 3.5rem; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;">⚔️</div>
          <h2 style="color: var(--accent-gold); font-size: 1.8rem; margin-bottom: 0.5rem; font-family: var(--font-header);">Convocação de Batalha!</h2>
          <p style="color: var(--text-parchment); font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.2rem;">
            O Mestre da Mesa está convocando os aventureiros para o combate!
          </p>
          
          <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(234,179,8,0.3); border-radius: 8px; padding: 12px; margin-bottom: 1.2rem; text-align: left;">
            <div style="font-weight: bold; color: var(--accent-red); margin-bottom: 6px; font-size: 0.9rem;">Ameaças em Batalha:</div>
            <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; display: flex; flex-direction: column; gap: 4px; color: var(--text-parchment);">
              ${monstersListHtml}
            </ul>
          </div>

          ${myChars.length > 0 ? `
            <div class="rpg-form-group" style="text-align: left; margin-bottom: 1.2rem;">
              <label class="rpg-label" style="font-size: 0.85rem;">Selecione seu Personagem:</label>
              <select id="global-invite-char-select" class="rpg-select" style="width:100%; font-size:1rem; padding:8px;">
                ${charOptionsHtml}
              </select>
            </div>
          ` : `
            <div class="rpg-form-group" style="text-align: left; margin-bottom: 1.2rem;">
              <label class="rpg-label" style="font-size: 0.85rem;">Digite o Nome do seu Guerreiro:</label>
              <input type="text" id="global-invite-char-name-input" class="rpg-input" placeholder="Ex: Thorin, o Guerreiro" value="${username}" style="width:100%; font-size:1rem; padding:8px;" />
            </div>
          `}

          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="rpg-btn" style="padding: 10px 25px; font-size: 1rem; background: linear-gradient(135deg, var(--accent-gold), #854d0e);" onclick="app.playerAcceptInviteFromGlobalModal()">
              ⚔️ Aceitar Desafio
            </button>
            <button class="rpg-btn rpg-btn-secondary" style="padding: 10px 20px; border-color: var(--accent-red); color: var(--accent-red);" onclick="app.playerAcceptBattleInvite(false)">
              Recusar
            </button>
          </div>
        </div>
      `;
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  playerAcceptInviteFromGlobalModal() {
    const username = this.currentUser ? this.currentUser.username : 'Jogador';
    const currentOwner = username.toLowerCase();
    const myChars = this.savedCharacters.filter(c => c.owner && c.owner.toLowerCase() === currentOwner);
    
    let charToEntry = null;
    
    if (myChars.length > 0) {
      const select = document.getElementById('global-invite-char-select');
      const charId = select ? select.value : '';
      charToEntry = myChars.find(c => c.id === charId) || myChars[0];
    } else {
      const input = document.getElementById('global-invite-char-name-input');
      const customName = input ? input.value.trim() : '';
      const charName = customName || username;
      charToEntry = {
        id: 'char_' + Date.now(),
        name: charName,
        owner: username,
        hpMax: 10,
        hpCurrent: 10,
        ca: 10,
        initBonus: 0
      };
    }
    
    const existing = this.dmCombatants.find(c => c.charId === charToEntry.id || (c.name && c.name.toLowerCase() === charToEntry.name.toLowerCase()));
    if (!existing) {
      const stats = this.calculateActiveStats ? this.calculateActiveStats(charToEntry) : {};
      this.dmCombatants.push({
        id: 'comb_' + Date.now(),
        charId: charToEntry.id,
        name: charToEntry.name,
        owner: username,
        type: 'player',
        hp: parseInt(charToEntry.hpCurrent) || parseInt(charToEntry.hpMax) || stats.maxHp || 10,
        maxHp: parseInt(charToEntry.hpMax) || stats.maxHp || 10,
        ac: parseInt(charToEntry.ca) || stats.ac || 10,
        initBonus: parseInt(charToEntry.initBonus) || stats.initiative || 0,
        initiative: 0,
        status: 'Ativo',
        notes: ''
      });
    }

    if (!this.playerResponses) this.playerResponses = {};
    this.playerResponses[username] = 'accepted';

    this.saveCombatState();
    
    const overlay = document.getElementById('global-battle-invite-overlay');
    if (overlay) overlay.style.display = 'none';

    this.playSound('victory');
    this.showToast(`Você aceitou o desafio com ${charToEntry.name}!`);
    this.switchTab('dm');
  }

  handleFirebasePermissionError(error) {
    if (error && (error.code === 'permission-denied' || String(error.message).toLowerCase().includes('permission'))) {
      let banner = document.getElementById('firebase-permission-warning-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'firebase-permission-warning-banner';
        banner.style.cssText = 'position:fixed; bottom:20px; right:20px; max-width:450px; background:#ef4444; color:#fff; border:2px solid #b91c1c; border-radius:8px; padding:15px; z-index:999999; box-shadow:0 10px 25px rgba(0,0,0,0.5); font-family:sans-serif; font-size:0.9rem; line-height:1.4;';
        document.body.appendChild(banner);
      }
      banner.innerHTML = `
        <div style="font-weight:bold; font-size:1rem; margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          ⚠️ Bloqueio de Permissão do Firebase
        </div>
        <div>
          O banco de dados do seu Firebase está recusando conexões (Erro: <code>permission-denied</code>). 
          Isso ocorre porque as regras de teste do Firebase expiraram.
        </div>
        <div style="margin-top:10px; font-weight:bold; color:#fef08a;">
          Como resolver em 1 minuto:
        </div>
        <ol style="margin:5px 0 0 20px; padding:0; list-style-type:decimal;">
          <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" style="color:#fff; text-decoration:underline; font-weight:bold;">Console do Firebase</a>.</li>
          <li>Vá em <strong>Build</strong> > <strong>Firestore Database</strong> > aba <strong>Rules</strong> (Regras).</li>
          <li>Substitua as regras por:<br>
            <pre style="background:rgba(0,0,0,0.3); padding:5px; border-radius:4px; font-size:0.75rem; overflow-x:auto; margin:5px 0; text-align:left;">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}</pre>
          </li>
          <li>Clique em <strong>Publish</strong> (Publicar) no topo direito.</li>
        </ol>
        <button onclick="this.parentElement.style.display='none'" style="margin-top:10px; background:#b91c1c; color:#fff; border:none; padding:6px 8px; border-radius:4px; cursor:pointer; font-weight:bold; width:100%;">Fechar Alerta</button>
      `;
      banner.style.display = 'block';
    }
  }

  getMonsterImageUrl(monsterName) {
    if (!monsterName) return 'rpg-icon.png';
    const name = String(monsterName).toLowerCase();
    if (name.includes('goblin') || name.includes('kobold') || name.includes('hobgoblin') || name.includes('bugbear')) {
      return 'img/monsters/goblin.png';
    }
    if (name.includes('orc') || name.includes('gnoll') || name.includes('troglodita')) {
      return 'img/monsters/orc.png';
    }
    if (name.includes('ogro') || name.includes('ogre') || name.includes('minotauro') || name.includes('minotaur') || name.includes('ettin') || name.includes('gigante')) {
      return 'img/monsters/ogre.png';
    }
    if (name.includes('troll') || name.includes('quimera') || name.includes('chimera') || name.includes('hidra') || name.includes('hydra')) {
      return 'img/monsters/troll.png';
    }
    if (name.includes('vermelho') || name.includes('azul') || name.includes('verde') || name.includes('negro') || name.includes('branco') || name.includes('ouro') || name.includes('prata') || name.includes('bronze') || name.includes('cobre') || name.includes('latão') || name.includes('sombra') || name.includes('dracolich') || name.includes('dragon') || name.includes('dragão')) {
      return 'img/monsters/red_dragon.png';
    }
    if (name.includes('behemoth') || name.includes('tarrasque') || name.includes('manticora')) {
      return 'img/monsters/behemoth.png';
    }
    if (name.includes('hecaton') || name.includes('hecatonchires') || name.includes('golem')) {
      return 'img/monsters/hecatoncheires.png';
    }
    if (name.includes('demilich') || name.includes('lich') || name.includes('espectro') || name.includes('wraith') || name.includes('vampiro') || name.includes('mumia') || name.includes('mummy')) {
      return 'img/monsters/demilich.png';
    }
    if (name.includes('orbe') || name.includes('gibbering') || name.includes('orb') || name.includes('beholder') || name.includes('observador') || name.includes('mímico') || name.includes('mimic') || name.includes('devorador') || name.includes('flayer')) {
      return 'img/monsters/gibbering_orb.png';
    }
    
    return 'rpg-icon.png';
  }

  getMonsterImageFilter(monsterName) {
    if (!monsterName) return '';
    const name = String(monsterName).toLowerCase();
    
    // Dragon colors (reusing red_dragon.png with hue-rotate or filters)
    if (name.includes('azul') || name.includes('blue')) {
      return 'filter: hue-rotate(240deg) saturate(1.2);';
    }
    if (name.includes('verde') || name.includes('green')) {
      return 'filter: hue-rotate(120deg) saturate(1.2);';
    }
    if (name.includes('negro') || name.includes('black') || name.includes('sombra') || name.includes('shadow')) {
      return 'filter: brightness(0.35) contrast(1.3) grayscale(0.5);';
    }
    if (name.includes('branco') || name.includes('white')) {
      return 'filter: brightness(1.65) contrast(0.85) saturate(0.15);';
    }
    if (name.includes('ouro') || name.includes('gold') || name.includes('bronze')) {
      return 'filter: hue-rotate(45deg) brightness(1.15) saturate(1.6);';
    }
    if (name.includes('prata') || name.includes('silver')) {
      return 'filter: grayscale(1) brightness(1.25);';
    }
    if (name.includes('cobre') || name.includes('copper') || name.includes('latão') || name.includes('brass')) {
      return 'filter: hue-rotate(15deg) brightness(0.98) saturate(1.45);';
    }
    if (name.includes('dracolich') || name.includes('lich')) {
      return 'filter: hue-rotate(280deg) brightness(0.75) saturate(0.85);';
    }
    
    return '';
  }

  editChronicle() {
    const viewMode = document.getElementById('chronicle-view-mode');
    const editMode = document.getElementById('chronicle-edit-mode');
    const titleInput = document.getElementById('edit-chronicle-title');
    const descInput = document.getElementById('edit-chronicle-desc');

    if (viewMode) viewMode.style.display = 'none';
    if (editMode) editMode.style.display = 'block';
    
    if (titleInput && this.chronicleData) titleInput.value = this.chronicleData.title || "";
    if (descInput && this.chronicleData) descInput.value = this.chronicleData.description || "";
  }

  cancelEditChronicle() {
    const viewMode = document.getElementById('chronicle-view-mode');
    const editMode = document.getElementById('chronicle-edit-mode');

    if (viewMode) viewMode.style.display = 'block';
    if (editMode) editMode.style.display = 'none';
  }

  saveChronicle() {
    const titleInput = document.getElementById('edit-chronicle-title');
    const descInput = document.getElementById('edit-chronicle-desc');
    
    if (!titleInput || !descInput) return;

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (this.firebaseInitialized && window.db) {
      const db = window.db;
      db.collection('campaign').doc('chronicle').set({
        title: title || "Nova Campanha",
        description: description || "Sem sinopse."
      }).then(() => {
        this.showToast("Crônica atualizada com sucesso!");
        this.cancelEditChronicle();
      }).catch(err => {
        console.error("Erro ao salvar crônica: ", err);
        alert("Erro ao salvar crônica.");
      });
    }
  }

  toggleMenu() {
    const navLinks = document.querySelector('.nav-links');
    const headerDiv = document.querySelector('.app-header > div:not(.logo)');
    
    if (navLinks) {
      navLinks.classList.toggle('menu-open');
    }
    if (headerDiv) {
      headerDiv.classList.toggle('menu-open');
    }
  }

  renderWelcomeScreenLocal() {
    const titleEl = document.getElementById('chronicle-title');
    const descEl = document.getElementById('chronicle-desc');
    const dmListEl = document.getElementById('welcome-dm-list');
    const playersListEl = document.getElementById('welcome-players-list');
    const editBtn = document.getElementById('btn-edit-chronicle');

    if (this.firebaseInitialized) {
      if (titleEl) titleEl.textContent = (this.chronicleData && this.chronicleData.title) ? this.chronicleData.title : "Valeiros Guerrentes - Crônica Ativa";
      if (descEl) descEl.textContent = (this.chronicleData && this.chronicleData.description) ? this.chronicleData.description : "Conectado à mesa online. O Mestre pode atualizar esta sinopse.";
      if (editBtn) editBtn.style.display = (this.currentUser && (this.currentUser.role === 'dm' || this.currentUser.role === 'admin')) ? 'inline-block' : 'none';
    } else {
      if (titleEl) titleEl.textContent = "Crônica Local (Offline)";
      if (descEl) descEl.textContent = "Você está jogando em modo offline. Configure o Firebase para jogar online com outros jogadores.";
      if (editBtn) editBtn.style.display = 'none';
    }

    let dmNames = [];
    let playersHtml = [];
    let foundCurrentUser = false;

    this.users.forEach(u => {
      if (this.currentUser && u.username.toLowerCase() === this.currentUser.username.toLowerCase()) {
        foundCurrentUser = true;
      }
      
      const isOnline = u.online === true || (this.currentUser && u.username.toLowerCase() === this.currentUser.username.toLowerCase());
      
      // Only list players/DMs in the welcome list if they are online!
      if (!isOnline) return;

      if (u.role === 'dm') {
        dmNames.push(u.username);
      } else {
        const statusText = 'Online';
        const statusColor = '#66cc66';
        
        let dmActions = '';
        if (this.currentUser && (this.currentUser.role === 'dm' || this.currentUser.role === 'admin')) {
          const showForceLogoff = u.username.toLowerCase() !== this.currentUser.username.toLowerCase();
          dmActions = `
            <div style="display: flex; gap: 6px; margin-left: auto; align-items: center;">
              ${showForceLogoff ? `<button class="rpg-btn" style="padding: 2px 6px; font-size: 0.7rem; background-color: #d97706; border-color: transparent;" onclick="app.forcePlayerLogout('', '${u.username}')" title="Forçar Logoff">Desconectar ⏻</button>` : ''}
            </div>
          `;
        }

        playersHtml.push(`<li style="color: var(--text-parchment); font-size: 0.95rem; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;">
          <span style="color: ${statusColor};">●</span> 
          <span>${u.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(${statusText})</span></span>
          ${dmActions}
        </li>`);
      }
    });

    if (!foundCurrentUser && this.currentUser) {
      if (this.currentUser.role === 'dm') {
        dmNames.push(this.currentUser.username);
      } else {
        playersHtml.push(`<li style="color: var(--text-parchment); font-size: 0.95rem; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; width: 100%;">
          <span style="color: #66cc66;">●</span> 
          <span>${this.currentUser.username} <span style="font-size: 0.75rem; color: var(--text-muted);">(Online)</span></span>
        </li>`);
      }
    }

    if (dmListEl) dmListEl.textContent = dmNames.length > 0 ? dmNames.join(', ') : 'Nenhum Mestre registrado.';
    if (playersListEl) {
      if (playersHtml.length > 0) {
        playersListEl.innerHTML = playersHtml.join('');
      } else {
        playersListEl.innerHTML = `<li style="color: var(--text-muted); font-style: italic;">Nenhum jogador online.</li>`;
      }
    }
  }

  forcePlayerLogout(uid, username) {
    if (!confirm(`Tem certeza que deseja forçar a desconexão de ${username}?`)) return;
    
    if (this.firebaseInitialized && window.db && uid) {
      window.db.collection('users').doc(uid).update({
        forceLogout: true,
        online: false
      }).then(() => {
        this.showToast(`Logoff forçado para ${username}.`);
        this.logAction(`Mestre/Admin forçou a desconexão de ${username}.`);
      }).catch(err => {
        console.error("Erro ao forçar logoff:", err);
        alert("Erro ao forçar logoff.");
      });
    } else {
      // Local/offline fallback
      const localUser = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (localUser) {
        localUser.online = false;
        localStorage.setItem('dnd3_users', JSON.stringify(this.users));
        this.showToast(`Logoff local forçado para ${username}.`);
        this.logAction(`Mestre/Admin forçou a desconexão local de ${username}.`);
        this.renderWelcomeScreenLocal();
      }
    }
  }

  togglePlayerStatus(uid, currentStatus) {
    if (!this.firebaseInitialized || !window.db) return;
    const db = window.db;
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    
    db.collection('users').doc(uid).update({
      status: newStatus
    }).then(() => {
      this.showToast(`Jogador ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!`);
    }).catch(err => {
      console.error("Erro ao alterar status do jogador: ", err);
      alert("Erro ao alterar status do jogador.");
    });
  }

  deletePlayer(uid, username) {
    if (!this.firebaseInitialized || !window.db) return;
    const db = window.db;
    
    this.showCustomConfirm(`Deseja realmente EXCLUIR permanentemente o jogador "${username}" e TODAS as suas fichas?`, () => {
      // 1. Delete all character sheets owned by this player
      db.collection('characters').where('owner', '==', username).get()
        .then((snapshot) => {
          const batch = db.batch();
          snapshot.forEach((doc) => {
            batch.delete(doc.ref);
          });
          return batch.commit();
        })
        .then(() => {
          // 2. Mark the user status as 'deleted' so they can be filtered out and blocked
          return db.collection('users').doc(uid).set({
            status: 'deleted'
          }, { merge: true });
        })
        .then(() => {
          this.showToast(`Jogador "${username}" e todas as suas fichas foram excluídos.`);
        })
        .catch((err) => {
          console.error("Erro ao excluir jogador: ", err);
          alert("Erro ao excluir jogador.");
        });
    });
  }

  renderManagePlayersTab() {
    const tableBody = document.getElementById('manage-players-table-body');
    if (!tableBody) return;

    const adminPanel = document.getElementById('admin-actions-container');
    if (adminPanel) {
      adminPanel.style.display = (this.currentUser && this.currentUser.role === 'admin') ? 'block' : 'none';
    }

    const getDisplayPassword = (u) => {
      if (!u) return '******';
      if (u.password) return u.password;
      const nameLower = u.username.toLowerCase();
      if (nameLower === 'diego') return 'Irons365.';
      if (nameLower === 'admin') return 'AdminIrons365.';
      return 'N/A (Alterar Senha)';
    };

    const renderLocal = () => {
      let html = [];
      this.users.forEach((user, idx) => {
        if (user.role === 'dm') {
          html.push(`
            <tr>
              <td style="font-weight:bold; color:var(--accent-gold);">${user.username} (Mestre)</td>
              <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
              <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
              <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
            </tr>
          `);
        } else if (user.role === 'admin') {
          html.push(`
            <tr>
              <td style="font-weight:bold; color:#66aacc;">${user.username} (Admin)</td>
              <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
              <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
              <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
            </tr>
          `);
        } else {
          html.push(`
            <tr>
              <td>${user.username}</td>
              <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
              <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
              <td style="text-align:center;">
                <div style="display:flex; gap:8px; justify-content:center;">
                  <button class="rpg-btn" style="padding:4px 8px; font-size:0.75rem; border-color:var(--accent-gold); color:var(--accent-gold); background:transparent;" onclick="app.changePlayerPassword('', '${user.username}')">Alterar Senha</button>
                  <button class="rpg-btn" style="padding:4px 8px; font-size:0.75rem; border-color:var(--accent-gold); color:var(--accent-gold); background:transparent;" onclick="app.promoteToDmLocal(${idx}, '${user.username}')">Tornar Mestre</button>
                  <button class="rpg-btn rpg-btn-secondary" style="padding:4px 8px; font-size:0.75rem; border-color:#ff4444; color:#ff4444;" onclick="app.deletePlayerLocal(${idx}, '${user.username}')">Excluir</button>
                </div>
              </td>
            </tr>
          `);
        }
      });
      tableBody.innerHTML = html.length > 0 ? html.join('') : `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhum usuário cadastrado.</td></tr>`;
    };

    if (this.firebaseInitialized && window.db) {
      db.collection('users').get().then((snapshot) => {
        if (snapshot.empty) {
          renderLocal();
          return;
        }
        let html = [];
        let foundCurrentUser = false;
        snapshot.forEach((doc) => {
          const user = doc.data();
          user.uid = doc.id;
          if (user.status === 'deleted') return;
          if (this.currentUser && user.username.toLowerCase() === this.currentUser.username.toLowerCase()) {
            foundCurrentUser = true;
          }
          
          if (user.role === 'dm') {
            html.push(`
              <tr>
                <td style="font-weight:bold; color:var(--accent-gold);">${user.username} (Mestre)</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
                <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
              </tr>
            `);
          } else if (user.role === 'admin') {
            html.push(`
              <tr>
                <td style="font-weight:bold; color:#66aacc;">${user.username} (Admin)</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
                <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
              </tr>
            `);
          } else {
            const status = user.status || 'active';
            const statusText = status === 'inactive' ? 'Inativo' : 'Ativo';
            const statusColor = status === 'inactive' ? '#ff4444' : '#66cc66';
            const statusBtnLabel = status === 'inactive' ? 'Ativar' : 'Desativar';
            
            html.push(`
              <tr>
                <td>${user.username}</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(user)}</td>
                <td style="text-align:center; color:${statusColor}; font-weight:bold;">${statusText}</td>
                <td style="text-align:center;">
                  <div style="display:flex; gap:8px; justify-content:center; flex-wrap: wrap;">
                    <button class="rpg-btn" style="padding:4px 8px; font-size:0.75rem; border-color:var(--accent-gold); color:var(--accent-gold); background:transparent;" onclick="app.changePlayerPassword('${user.uid}', '${user.username}')">Alterar Senha</button>
                    <button class="rpg-btn" style="padding:4px 8px; font-size:0.75rem; background-color:${status === 'inactive' ? '#449944' : '#994444'}; border-color:transparent;" onclick="app.togglePlayerStatus('${user.uid}', '${status}')">${statusBtnLabel}</button>
                    <button class="rpg-btn" style="padding:4px 8px; font-size:0.75rem; border-color:var(--accent-gold); color:var(--accent-gold); background:transparent;" onclick="app.promoteToDm('${user.uid}', '${user.username}')">Tornar Mestre</button>
                    <button class="rpg-btn rpg-btn-secondary" style="padding:4px 8px; font-size:0.75rem; border-color:#ff4444; color:#ff4444;" onclick="app.deletePlayer('${user.uid}', '${user.username}')">Excluir</button>
                  </div>
                </td>
              </tr>
            `);
          }
        });

        if (!foundCurrentUser && this.currentUser) {
          if (this.currentUser.role === 'dm') {
            html.unshift(`
              <tr>
                <td style="font-weight:bold; color:var(--accent-gold);">${this.currentUser.username} (Mestre)</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(this.currentUser)}</td>
                <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
              </tr>
            `);
          } else if (this.currentUser.role === 'admin') {
            html.unshift(`
              <tr>
                <td style="font-weight:bold; color:#66aacc;">${this.currentUser.username} (Admin)</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(this.currentUser)}</td>
                <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
              </tr>
            `);
          } else {
            html.push(`
              <tr>
                <td>${this.currentUser.username}</td>
                <td style="text-align:center; font-family: monospace; font-weight: bold; color: #aa7c11;">${getDisplayPassword(this.currentUser)}</td>
                <td style="text-align:center; color:#66cc66; font-weight:bold;">Ativo</td>
                <td style="text-align:center; color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhuma ação disponível</td>
              </tr>
            `);
          }
        }
        
        tableBody.innerHTML = html.join('');
      }).catch(err => {
        console.error("Erro ao carregar jogadores no controle:", err);
        renderLocal();
      });
    } else {
      renderLocal();
    }
  }

  changePlayerPassword(uid, username) {
    const newPass = prompt(`Digite a nova senha para o jogador "${username}":`);
    if (!newPass) return;
    if (newPass.length < 3) {
      alert("A senha deve ter pelo menos 3 caracteres.");
      return;
    }

    if (this.firebaseInitialized && window.db && uid) {
      window.db.collection('users').doc(uid).update({
        password: newPass
      }).then(() => {
        this.showToast(`Senha de ${username} alterada com sucesso!`);
        this.logAction(`Mestre/Admin alterou a senha de ${username}.`);
        this.renderManagePlayersTab();
      }).catch(err => {
        console.error("Erro ao alterar senha:", err);
        alert("Erro ao alterar senha.");
      });
    } else {
      const localUser = this.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (localUser) {
        localUser.password = newPass;
        localStorage.setItem('dnd3_users', JSON.stringify(this.users));
        this.showToast(`Senha local de ${username} alterada com sucesso!`);
        this.logAction(`Mestre/Admin alterou a senha local de ${username}.`);
        this.renderWelcomeScreenLocal();
        this.renderManagePlayersTab();
      }
    }
  }

  promoteToDm(uid, username) {
    const isDm = this.currentUser && this.currentUser.role === 'dm';
    const confirmMsg = isDm
      ? `Deseja realmente transferir o cargo de Mestre para "${username}"? Você se tornará um jogador e "${username}" será o novo Mestre.`
      : `Deseja realmente transferir o cargo de Mestre para "${username}"? O Mestre atual se tornará um jogador.`;

    this.showCustomConfirm(confirmMsg, () => {
      if (this.firebaseInitialized && window.db) {
        const db = window.db;
        // Find current DM in Firestore to demote
        db.collection('users').where('role', '==', 'dm').get().then((snapshot) => {
          const batch = db.batch();
          snapshot.forEach((doc) => {
            batch.update(doc.ref, { role: 'player' });
          });
          
          // Promote target
          const targetRef = db.collection('users').doc(uid);
          batch.update(targetRef, { role: 'dm' });
          
          return batch.commit();
        })
        .then(() => {
          // Sync local storage users list
          this.users.forEach(u => {
            if (u.role === 'dm') u.role = 'player';
            if (u.username.toLowerCase() === username.toLowerCase()) u.role = 'dm';
          });
          localStorage.setItem('dnd3_users', JSON.stringify(this.users));

          // If current user was the DM, update their role
          if (isDm) {
            this.currentUser.role = 'player';
            localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
          }

          this.showToast(`Cargo de Mestre transferido para "${username}".`);
          this.updateAuthState();
          if (this.activeTab === 'manage-players') {
            this.renderManagePlayersTab();
          }
        })
        .catch((err) => {
          console.error("Erro ao transferir Mestre: ", err);
          alert("Erro ao transferir cargo de Mestre.");
        });
      }
    });
  }

  promoteToDmLocal(idx, username) {
    const isDm = this.currentUser && this.currentUser.role === 'dm';
    const confirmMsg = isDm
      ? `Deseja realmente transferir o cargo de Mestre para "${username}"? Você se tornará um jogador e "${username}" será o novo Mestre (Local).`
      : `Deseja realmente transferir o cargo de Mestre para "${username}"? O Mestre atual se tornará um jogador (Local).`;

    this.showCustomConfirm(confirmMsg, () => {
      // Demote existing DM
      this.users.forEach(u => {
        if (u.role === 'dm') u.role = 'player';
      });

      // Promote target
      if (this.users[idx]) {
        this.users[idx].role = 'dm';
      }
      localStorage.setItem('dnd3_users', JSON.stringify(this.users));

      // If current user was the DM, update their role
      if (isDm) {
        this.currentUser.role = 'player';
        localStorage.setItem('dnd3_current_user', JSON.stringify(this.currentUser));
      }

      this.showToast(`Cargo de Mestre transferido para "${username}" (Local).`);
      this.updateAuthState();
      if (this.activeTab === 'manage-players') {
        this.renderManagePlayersTab();
      }
    });
  }

  deletePlayerLocal(idx, username) {
    this.showCustomConfirm(`Deseja realmente EXCLUIR permanentemente o jogador "${username}" e todas as suas fichas (Local)?`, () => {
      // Delete characters
      this.savedCharacters = this.savedCharacters.filter(c => c.owner !== username);
      localStorage.setItem('dnd3_characters', JSON.stringify(this.savedCharacters));
      
      // Delete user
      this.users.splice(idx, 1);
      localStorage.setItem('dnd3_users', JSON.stringify(this.users));
      
      this.showToast(`Jogador "${username}" excluído localmente.`);
      this.renderManagePlayersTab();
    });
  }

  deleteAllLogins() {
    this.showCustomConfirm("⚠️ ATENÇÃO: Deseja realmente EXCLUIR permanentemente TODOS os jogadores cadastrados e TODAS as suas fichas do sistema? Esta ação é irreversível!", () => {
      if (this.firebaseInitialized && window.db) {
        const db = window.db;
        
        // 1. Delete characters
        db.collection('characters').get()
          .then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach((doc) => {
              batch.delete(doc.ref);
            });
            return batch.commit();
          })
          .then(() => {
            // 2. Delete users (except diego and admin)
            return db.collection('users').get();
          })
          .then((snapshot) => {
            const batch = db.batch();
            snapshot.forEach((doc) => {
              const data = doc.data();
              const username = (data.username || "").toLowerCase();
              if (username !== 'diego' && username !== 'admin') {
                batch.delete(doc.ref);
              }
            });
            return batch.commit();
          })
          .then(() => {
            // Sync local storage users list
            this.users = this.users.filter(u => u.username === 'diego' || u.username === 'admin');
            localStorage.setItem('dnd3_users', JSON.stringify(this.users));
            this.savedCharacters = [];
            localStorage.setItem('dnd3_characters', JSON.stringify([]));

            this.showToast("Todos os logins (exceto Mestre e Admin) e fichas foram excluídos com sucesso!");
            this.renderManagePlayersTab();
          })
          .catch((err) => {
            console.error("Erro ao excluir todos os logins: ", err);
            alert("Erro ao excluir todos os logins.");
          });
      } else {
        // Local Mode
        this.users = this.users.filter(u => u.username === 'diego' || u.username === 'admin');
        localStorage.setItem('dnd3_users', JSON.stringify(this.users));
        this.savedCharacters = [];
        localStorage.setItem('dnd3_characters', JSON.stringify([]));
        
        this.showToast("Todos os logins locais (exceto Mestre e Admin) foram excluídos.");
        this.renderManagePlayersTab();
      }
    });
  }

  addEnemyCreatorBuffRow(name = "", effect = "") {
    const list = document.getElementById('enemy-creator-buffs-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'enemy-creator-buff-row';
    row.style = 'display:flex; gap:6px;';
    row.innerHTML = `
      <input type="text" class="rpg-input buff-name" placeholder="Nome (Ex: Fúria)" value="${name}" style="flex:0.4; font-size:0.75rem; padding:2px 4px; height:24px;">
      <input type="text" class="rpg-input buff-effect" placeholder="Efeito (Ex: +2 CA, +4 HP)" value="${effect}" style="flex:0.6; font-size:0.75rem; padding:2px 4px; height:24px;">
      <button type="button" class="rpg-btn" style="padding:0 6px; font-size:0.65rem; height:24px; background:#8b0000; border:none;" onclick="this.parentElement.remove()">🗑️</button>
    `;
    list.appendChild(row);
  }

  addEnemyCreatorDebuffRow(name = "", effect = "") {
    const list = document.getElementById('enemy-creator-debuffs-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'enemy-creator-debuff-row';
    row.style = 'display:flex; gap:6px;';
    row.innerHTML = `
      <input type="text" class="rpg-input debuff-name" placeholder="Nome (Ex: Enredado)" value="${name}" style="flex:0.4; font-size:0.75rem; padding:2px 4px; height:24px;">
      <input type="text" class="rpg-input debuff-effect" placeholder="Efeito (Ex: -2 CA)" value="${effect}" style="flex:0.6; font-size:0.75rem; padding:2px 4px; height:24px;">
      <button type="button" class="rpg-btn" style="padding:0 6px; font-size:0.65rem; height:24px; background:#8b0000; border:none;" onclick="this.parentElement.remove()">🗑️</button>
    `;
    list.appendChild(row);
  }

  onEnemyAvatarPresetChange(preset) {
    const customGroup = document.getElementById('enemy-custom-avatar-group');
    const urlInput = document.getElementById('enemy-avatar-url');
    if (preset === 'custom') {
      if (customGroup) customGroup.style.display = 'block';
    } else {
      if (customGroup) customGroup.style.display = 'none';
      if (urlInput) {
        if (preset === 'goblin') urlInput.value = 'img/monsters/goblin.png';
        else if (preset === 'orc') urlInput.value = 'img/monsters/orc.png';
        else if (preset === 'ogre') urlInput.value = 'img/monsters/ogre.png';
        else if (preset === 'troll') urlInput.value = 'img/monsters/troll.png';
        else if (preset === 'red_dragon') urlInput.value = 'img/monsters/red_dragon.png';
        else if (preset === 'behemoth') urlInput.value = 'img/monsters/behemoth.png';
        else if (preset === 'hecatoncheires') urlInput.value = 'img/monsters/hecatoncheires.png';
        else if (preset === 'demilich') urlInput.value = 'img/monsters/demilich.png';
        else if (preset === 'gibbering_orb') urlInput.value = 'img/monsters/gibbering_orb.png';
      }
    }
  }

  generateEnemyByLevel() {
    const levelInput = document.getElementById('enemy-gen-level');
    let level = parseInt(levelInput?.value) || 1;
    level = Math.max(1, Math.min(99, level));
    if (levelInput) levelInput.value = level;

    const archSelect = document.getElementById('enemy-gen-archetype');
    let archetype = archSelect?.value || 'random';

    const archetypes = ['brute', 'rogue', 'mage', 'cleric', 'dragon', 'undead'];
    if (archetype === 'random') {
      archetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    }

    // Name titles by archetype and tier
    const titlesLow = {
      brute: ['Goblin Salteador', 'Orc Guerreiro', 'Bandido Brutal', 'Hobgoblin Guarda', 'Lobisomem Menor'],
      rogue: ['Goblin Ladrão', 'Assassino Noturno', 'Batedor Sorrateiro', 'Ladrão de Guilda', 'Rato Sombrio'],
      mage: ['Aprendiz Goblin', 'Cultista Fanático', 'Acólito do Fogo', 'Mago Errante', 'Invocador Novato'],
      cleric: ['Xamã Tribal', 'Acólito da Morte', 'Sacerdote Fanático', 'Clérigo da Guerra', 'Fanático Sombrio'],
      dragon: ['Dragonete da Caverna', 'Serpente Wyrmling', 'Quimera Jovem', 'Basilisco Selvagem', 'Wyvern Menor'],
      undead: ['Esqueleto Legionário', 'Zumbi Pútrido', 'Carniçal Devorador', 'Aparição Menor', 'Espectro Noturno']
    };

    const titlesMid = { // Levels 6-15
      brute: ['Ogro Destruidor', 'Troll das Cavernas', 'Minotauro Berserker', 'Gigante da Colina', 'Cavaleiro Sangrento'],
      rogue: ['Assassino das Sombras', 'Mestre Rastreador', 'Espião Espectral', 'Lâmina Envenenada', 'Predador da Noite'],
      mage: ['Mago de Batalha', 'Feiticeiro do Caos', 'Conjurador Elemental', 'Necromante Mestre', 'Mestre Arcano'],
      cleric: ['Sumo Sacerdote Negro', 'Algoz da Destruição', 'Bispo Profano', 'Guardião da Tumba Negra', 'Senhor da Praga'],
      dragon: ['Dragão Jovem Cruel', 'Hidra Venenosa de 7 Cabeças', 'Dragão Vermelho Adulto', 'Wyrm da Tempestade', 'Besta Abissal'],
      undead: ['Múmia Faraônica', 'Vampiro Aristocrata', 'Cavaleiro da Morte', 'Lorde Carniçal', 'Wraith Dread']
    };

    const titlesHigh = { // Levels 16-25
      brute: ['Gigante do Fogo Supremo', 'Demônio Balor Brutal', 'Guerreiro Abissal Titânico', 'Golem de Ferro Infernal', 'General do Tártaro'],
      rogue: ['Lâmina Invisível Mestra', 'Assassino Astral', 'Predador de Almas', 'Mestre da Guilda das Sombras', 'Sombra Mortal'],
      mage: ['Arquimago Supremo', 'Lich Ancião Arcano', 'Senhor das Chamas Abissais', 'Mestre do Tempo Arcano', 'Avatar da Transmutação'],
      cleric: ['Arauto do Apocalipse', 'Patriarca do Vazio', 'Pontífice Profano das Trevas', 'Avatar da Deusa da Morte', 'Santo Sombrio'],
      dragon: ['Dragão Vermelho Ancião', 'Leviatã das Profundezas', 'Dragão de Ouro Renegado', 'Behemoth Devastador', 'Wyrm Celestial Corrompido'],
      undead: ['Lorde Vampiro Ancião', 'Lich Lorde da Cripta', 'Demilich Espectral', 'Rei Esqueleto Imortal', 'Mestre do Sepulcro']
    };

    const titlesEpic = { // Levels 26-50+
      brute: ['Hecatonquiro Titânico', 'Behemoth Cósmico', 'Colosso da Destruição', 'Avatar de Ferro Primordial', 'Titã Destruidor de Mundos'],
      rogue: ['Assassino do Fim dos Tempos', 'Fantasma do Éter Supremo', 'Lâmina do Eclipse Infinito', 'Predador Cósmico Imaterial', 'Morte Silenciosa Cósmica'],
      mage: ['Arquimago Cósmico Primordial', 'Senhor da Entropia Infinita', 'Avatar do Caos Arcano', 'Teurgista Dimensional Supremo', 'Demilich Cósmico'],
      cleric: ['Senhor do Vazio Eterno', 'Sumo Avatar da Destruição Divina', 'Arauto da Eternidade', 'Patriarca Divino Corrompido', 'Regente da Noite Eterna'],
      dragon: ['Dragão Ancestral Primordial', 'Leviatã Celestial Cósmico', 'Dragão Devorador de Estrelas', 'Grande Wyrm da Destruição', 'Titã Dracônico Supremo'],
      undead: ['Demilich Ancestral Cósmico', 'Rei Lich da Noite Eterna', 'Lorde dos Mortos Primordial', 'Avatar da Morte Cósmica', 'Soberano das Almas Perdidas']
    };

    let titleList;
    if (level <= 5) titleList = titlesLow[archetype];
    else if (level <= 15) titleList = titlesMid[archetype];
    else if (level <= 25) titleList = titlesHigh[archetype];
    else titleList = titlesEpic[archetype];

    const randomName = titleList[Math.floor(Math.random() * titleList.length)];
    const monsterName = `${randomName} (Nvl ${level})`;

    // Action economy
    let actions = 1;
    if (level >= 36) actions = 4;
    else if (level >= 21) actions = 3;
    else if (level >= 11) actions = 2;

    // Attributes scaling
    let baseAttrs = {
      brute: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 8 },
      rogue: { str: 10, dex: 16, con: 13, int: 14, wis: 10, cha: 12 },
      mage: { str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 12 },
      cleric: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 14 },
      dragon: { str: 18, dex: 10, con: 17, int: 12, wis: 12, cha: 14 },
      undead: { str: 14, dex: 14, con: 10, int: 14, wis: 14, cha: 15 }
    }[archetype];

    const statGrowth = Math.floor(level / 4);
    const epicBonus = level > 20 ? Math.floor((level - 20) / 2) : 0;
    
    let str = baseAttrs.str + (archetype === 'brute' || archetype === 'dragon' ? statGrowth * 2 + epicBonus : statGrowth);
    let dex = baseAttrs.dex + (archetype === 'rogue' ? statGrowth * 2 + epicBonus : Math.floor(statGrowth / 2));
    let con = archetype === 'undead' ? 10 : baseAttrs.con + (archetype === 'brute' || archetype === 'dragon' ? statGrowth * 2 + epicBonus : statGrowth);
    let int_ = baseAttrs.int + (archetype === 'mage' ? statGrowth * 2 + epicBonus : Math.floor(statGrowth / 3));
    let wis = baseAttrs.wis + (archetype === 'cleric' ? statGrowth * 2 + epicBonus : Math.floor(statGrowth / 3));
    let cha = baseAttrs.cha + (archetype === 'undead' || archetype === 'cleric' ? statGrowth + epicBonus : Math.floor(statGrowth / 3));

    const strMod = Math.floor((str - 10) / 2);
    const dexMod = Math.floor((dex - 10) / 2);
    const conMod = archetype === 'undead' ? 0 : Math.floor((con - 10) / 2);
    const intMod = Math.floor((int_ - 10) / 2);
    const wisMod = Math.floor((wis - 10) / 2);
    const chaMod = Math.floor((cha - 10) / 2);

    // HP calculation
    const hdSize = { brute: 12, dragon: 12, undead: 12, cleric: 8, rogue: 8, mage: 4 }[archetype];
    const avgHpPerHd = Math.max(1, Math.round(hdSize * 0.65) + conMod);
    const baseHp = Math.max(6, hdSize + conMod + (level - 1) * avgHpPerHd);

    // CA (Armor Class)
    const armorBonus = Math.floor(level * 0.8) + (archetype === 'brute' || archetype === 'dragon' ? 3 : 1);
    const baseAc = 10 + dexMod + armorBonus + (level > 20 ? Math.floor((level - 20) / 2) : 0);

    // Initiative
    const baseInitMod = dexMod + (archetype === 'rogue' ? 4 : 0);

    // Spell Resistance (RM)
    let rm = 0;
    if (level >= 5 && (archetype === 'dragon' || archetype === 'mage' || archetype === 'undead' || level >= 15)) {
      rm = 11 + level + (archetype === 'dragon' || archetype === 'undead' ? 2 : 0);
    }

    // Saves
    const baseGoodSave = Math.floor(level / 2) + 2 + epicBonus;
    const basePoorSave = Math.floor(level / 3) + epicBonus;

    let fort = basePoorSave + conMod;
    let ref_ = basePoorSave + dexMod;
    let will = basePoorSave + wisMod;

    if (archetype === 'brute') { fort = baseGoodSave + conMod; }
    else if (archetype === 'rogue') { ref_ = baseGoodSave + dexMod; }
    else if (archetype === 'mage') { will = baseGoodSave + wisMod; }
    else if (archetype === 'cleric') { fort = baseGoodSave + conMod; will = baseGoodSave + wisMod; }
    else if (archetype === 'dragon') { fort = baseGoodSave + conMod; ref_ = baseGoodSave + dexMod; will = baseGoodSave + wisMod; }
    else if (archetype === 'undead') { will = baseGoodSave + wisMod; }

    // BAB & Attacks
    const babRate = (archetype === 'brute' || archetype === 'dragon') ? 1.0 : (archetype === 'mage' ? 0.5 : 0.75);
    const standardBab = Math.floor(Math.min(20, level) * babRate);
    const epicBab = level > 20 ? Math.floor((level - 20 + 1) / 2) : 0;
    const bab = standardBab + epicBab;

    const magicBonus = Math.min(10, Math.floor(level / 4));
    const atkStatMod = (archetype === 'rogue' && dexMod > strMod) ? dexMod : strMod;
    const atkBonus = bab + atkStatMod;

    // Build Weapons
    let weapons = [];
    const dmgBonus = atkStatMod;

    if (archetype === 'brute') {
      const diceCount = Math.max(1, Math.floor(level / 8) + 1);
      weapons.push({
        name: level >= 20 ? "Montante Titânica Vorpal" : (level >= 10 ? "Espada Grande de Aço Negro" : "Espadão Pesado"),
        atkBonus: atkBonus,
        diceCount: diceCount,
        diceSize: 12,
        dmgBonus: dmgBonus,
        magicBonus: magicBonus,
        effect: level >= 15 ? "Dano de Fogo +2d6" : (level >= 8 ? "Impacto Pesado" : ""),
        critical: "19-20/x2"
      });
      if (level >= 8) {
        weapons.push({
          name: "Golpe Esmagador (Pancada)",
          atkBonus: atkBonus - 2,
          diceCount: diceCount,
          diceSize: 8,
          dmgBonus: Math.floor(dmgBonus * 1.5),
          magicBonus: magicBonus,
          effect: "Derruba o alvo se falhar em Fortitude CD " + (10 + Math.floor(level/2) + strMod),
          critical: "20/x2"
        });
      }
    } else if (archetype === 'rogue') {
      const sneakDice = Math.ceil(level / 2);
      weapons.push({
        name: level >= 15 ? "Adaga Espectral das Sombras" : "Adaga Envenenada",
        atkBonus: atkBonus,
        diceCount: 1,
        diceSize: 6,
        dmgBonus: dmgBonus,
        magicBonus: magicBonus,
        effect: `Veneno Paralisante (Fort CD ${10 + Math.floor(level/2) + dexMod}) + Furtivo (+${sneakDice}d6)`,
        critical: "18-20/x2"
      });
      weapons.push({
        name: "Arco Curto Composto Veloz",
        atkBonus: bab + dexMod,
        diceCount: 1,
        diceSize: 8,
        dmgBonus: Math.min(3, strMod),
        magicBonus: magicBonus,
        effect: `Ataque à distância (+${sneakDice}d6 furtivo se desprevenido)`,
        critical: "20/x3"
      });
    } else if (archetype === 'mage') {
      weapons.push({
        name: level >= 20 ? "Cajado do Arquimago (Raio Arcano)" : "Raio Elemental (Toque)",
        atkBonus: bab + dexMod,
        diceCount: Math.max(1, Math.floor(level / 4) + 1),
        diceSize: 8,
        dmgBonus: intMod,
        magicBonus: magicBonus,
        effect: "Dano de Energia Arcana pura / Fogo",
        critical: "20/x2"
      });
    } else if (archetype === 'cleric') {
      weapons.push({
        name: level >= 15 ? "Maça Profana da Ruína" : "Maça Pesada Sagrada/Profana",
        atkBonus: atkBonus,
        diceCount: Math.max(1, Math.floor(level / 10) + 1),
        diceSize: 8,
        dmgBonus: dmgBonus,
        magicBonus: magicBonus,
        effect: "Dano profano/sagrado + Maldição",
        critical: "20/x2"
      });
    } else if (archetype === 'dragon') {
      const diceCount = Math.max(2, Math.floor(level / 6) + 1);
      weapons.push({
        name: "Mordida Dracônica Flamejante",
        atkBonus: atkBonus,
        diceCount: diceCount,
        diceSize: 8,
        dmgBonus: Math.floor(dmgBonus * 1.5),
        magicBonus: magicBonus,
        effect: `Fogo +${Math.max(1, Math.floor(level/5))}d6`,
        critical: "19-20/x2"
      });
      weapons.push({
        name: "Garras Dracônicas (x2)",
        atkBonus: atkBonus - 2,
        diceCount: Math.max(1, diceCount - 1),
        diceSize: 6,
        dmgBonus: dmgBonus,
        magicBonus: magicBonus,
        effect: "Dilacerar se ambos acertarem",
        critical: "20/x2"
      });
      if (level >= 10) {
        weapons.push({
          name: "Golpe de Cauda",
          atkBonus: atkBonus - 4,
          diceCount: diceCount,
          diceSize: 8,
          dmgBonus: dmgBonus,
          magicBonus: magicBonus,
          effect: "Atropelar múltiplos alvos",
          critical: "20/x2"
        });
      }
    } else if (archetype === 'undead') {
      weapons.push({
        name: level >= 15 ? "Toque Espectral Devorador de Almas" : "Garras Paralisantes",
        atkBonus: atkBonus,
        diceCount: Math.max(1, Math.floor(level / 8) + 1),
        diceSize: 8,
        dmgBonus: strMod,
        magicBonus: magicBonus,
        effect: `Dreno de 1d4 Níveis de Energia (Fort CD ${10 + Math.floor(level/2) + chaMod})`,
        critical: "20/x2"
      });
    }

    // Build Spells
    let spells = [];
    if (archetype === 'mage' || archetype === 'dragon' || archetype === 'undead') {
      if (level >= 1) spells.push("Mísseis Mágicos (Magic Missile)", "Escudo Arcano (Shield)");
      if (level >= 5) spells.push("Bola de Fogo (Fireball)", "Velocidade (Haste)", "Invisibilidade");
      if (level >= 10) spells.push("Cone Glacial (Cone of Cold)", "Teletransporte (Teleport)", "Muralha de Força");
      if (level >= 15) spells.push("Desintegração (Disintegrate)", "Dedo da Morte (Finger of Death)", "Dominar Monstro");
      if (level >= 20) spells.push("Parar o Tempo (Time Stop)", "Chuva de Meteoros (Meteor Swarm)", "Desejo (Wish)");
      if (level >= 30) spells.push("Ruína Épica (Epic Ruin)", "Eclipse Arcano Épico", "Muralha Prismática Maior");
    } else if (archetype === 'cleric') {
      if (level >= 1) spells.push("Curar Ferimentos Leves", "Bênção Divina", "Escudo da Fé");
      if (level >= 5) spells.push("Rogar Maldição (Bestow Curse)", "Oração", "Dissipar Magia");
      if (level >= 10) spells.push("Coluna de Chamas (Flame Strike)", "Praga", "Restauração Plena");
      if (level >= 15) spells.push("Mutilação (Harm)", "Destruição (Destruction)", "Cura Completa (Heal)");
      if (level >= 20) spells.push("Implosão (Implosion)", "Tempestade da Vingança", "Portal Divino");
      if (level >= 30) spells.push("Julgamento Final Épico", "Ressurreição Verdadeira");
    }

    // Build Specials
    let specials = ["Visão no Escuro 18m"];
    if (archetype === 'brute') {
      specials.push(`Redução de Dano ${Math.min(25, Math.floor(level/2))}/-`);
      specials.push("Fúria Bárbara (+4 FOR, +4 CON)");
      if (level >= 10) specials.push("Trespassar Aprimorado", "Ataque Poderoso");
    } else if (archetype === 'rogue') {
      specials.push(`Ataque Furtivo +${Math.ceil(level/2)}d6`);
      specials.push("Evasão Aprimorada (Não sofre dano em Ref)");
      specials.push("Esquiva Sobrenatural");
      if (level >= 10) specials.push("Mente Escorregadia", "Golpe Incapacitante");
    } else if (archetype === 'mage') {
      specials.push("Contramágica Aprimorada");
      specials.push("Conjuração Instantânea");
      if (level >= 12) specials.push("Manto de Resistência Arcana");
    } else if (archetype === 'cleric') {
      specials.push("Comandar / Expulsar Mortos-Vivos");
      specials.push("Aura de Corrupção / Glória Divina");
      if (level >= 10) specials.push("Imunidade a Doenças e Venenos");
    } else if (archetype === 'dragon') {
      specials.push(`Sopro de Fogo (${Math.min(30, level)}d6 de dano, Ref CD ${10 + Math.floor(level/2) + conMod})`);
      specials.push(`Presença Aterradora 18m (Vontade CD ${10 + Math.floor(level/2) + chaMod})`);
      specials.push(`Redução de Dano ${Math.min(20, Math.floor(level/2))}/Magia`);
      specials.push("Imunidade a Fogo, Sono e Paralisia");
      specials.push("Voo Rápido (Deslocamento 45m)");
    } else if (archetype === 'undead') {
      specials.push("Imunidade a Acertos Críticos, Veneno e Sono");
      specials.push(`Resistência a Expulsão +${Math.min(10, Math.floor(level/3))}`);
      specials.push(`Redução de Dano ${Math.min(20, Math.floor(level/2))}/Prata e Magia`);
      specials.push("Imunidade a Efeitos Mentais");
    }

    // Buffs & Debuffs
    let buffs = [];
    let debuffs = [];
    if (archetype === 'brute') {
      buffs.push({ name: "Fúria Bárbara", effect: "+4 for, +4 con, -2 ca" });
      if (level >= 10) buffs.push({ name: "Pele Rochosa", effect: "+4 ca" });
    } else if (archetype === 'mage') {
      buffs.push({ name: "Armadura Arcana", effect: "+4 ca" });
      buffs.push({ name: "Escudo Arcano", effect: "+4 ca" });
      if (level >= 8) buffs.push({ name: "Velocidade (Haste)", effect: "+1 ca, +1 ref" });
    } else if (archetype === 'cleric') {
      buffs.push({ name: "Poder Divino", effect: "+4 for, +10 hp" });
      buffs.push({ name: "Escudo da Fé", effect: "+3 ca" });
    } else if (archetype === 'dragon') {
      buffs.push({ name: "Fúria Dracônica", effect: "+4 for, +4 con" });
    } else if (archetype === 'undead') {
      buffs.push({ name: "Manto das Sombras", effect: "+4 ca" });
      debuffs.push({ name: "Dreno de Energia", effect: "-2 fort, -2 ref, -2 will" });
    }

    if (archetype === 'rogue') {
      debuffs.push({ name: "Veneno Debilitante", effect: "-4 for, -4 ref" });
    }

    // Avatar selector
    let avatarUrl = "rpg-icon.png";
    if (archetype === 'dragon') avatarUrl = "img/monsters/red_dragon.png";
    else if (archetype === 'brute') {
      if (level <= 4) avatarUrl = "img/monsters/goblin.png";
      else if (level <= 8) avatarUrl = "img/monsters/orc.png";
      else if (level <= 14) avatarUrl = "img/monsters/ogre.png";
      else if (level <= 22) avatarUrl = "img/monsters/troll.png";
      else avatarUrl = "img/monsters/behemoth.png";
    } else if (archetype === 'rogue') {
      avatarUrl = level <= 6 ? "img/monsters/goblin.png" : "img/monsters/orc.png";
    } else if (archetype === 'mage') {
      avatarUrl = level <= 15 ? "img/monsters/gibbering_orb.png" : "img/monsters/demilich.png";
    } else if (archetype === 'undead') {
      avatarUrl = "img/monsters/demilich.png";
    } else if (archetype === 'cleric') {
      avatarUrl = level >= 20 ? "img/monsters/hecatoncheires.png" : "img/monsters/orc.png";
    }

    // Fill form elements
    document.getElementById('enemy-id').value = "";
    document.getElementById('enemy-name').value = monsterName;
    document.getElementById('enemy-level').value = level;
    document.getElementById('enemy-actions').value = actions;
    document.getElementById('enemy-hp').value = baseHp;
    document.getElementById('enemy-ac').value = baseAc;
    document.getElementById('enemy-init').value = baseInitMod;
    document.getElementById('enemy-rm').value = rm;

    document.getElementById('enemy-save-fort').value = fort;
    document.getElementById('enemy-save-ref').value = ref_;
    document.getElementById('enemy-save-will').value = will;

    if (document.getElementById('enemy-attr-str')) document.getElementById('enemy-attr-str').value = str;
    if (document.getElementById('enemy-attr-dex')) document.getElementById('enemy-attr-dex').value = dex;
    if (document.getElementById('enemy-attr-con')) document.getElementById('enemy-attr-con').value = con;
    if (document.getElementById('enemy-attr-int')) document.getElementById('enemy-attr-int').value = int_;
    if (document.getElementById('enemy-attr-wis')) document.getElementById('enemy-attr-wis').value = wis;
    if (document.getElementById('enemy-attr-cha')) document.getElementById('enemy-attr-cha').value = cha;

    document.getElementById('enemy-avatar-url').value = avatarUrl;
    const avatarPreview = document.getElementById('enemy-avatar-preview');
    if (avatarPreview) avatarPreview.src = avatarUrl;

    this.enemyCreatorSelectedWeapons = weapons;
    this.renderEnemyCreatorWeapons();

    this.enemyCreatorSelectedSpells = spells;
    this.renderEnemyCreatorSpells();

    this.enemyCreatorSelectedSpecials = specials;
    this.renderEnemyCreatorSpecials();

    // Render buffs
    const buffsList = document.getElementById('enemy-creator-buffs-list');
    if (buffsList) {
      buffsList.innerHTML = "";
      buffs.forEach(b => this.addEnemyCreatorBuffRow(b.name, b.effect));
    }

    // Render debuffs
    const debuffsList = document.getElementById('enemy-creator-debuffs-list');
    if (debuffsList) {
      debuffsList.innerHTML = "";
      debuffs.forEach(d => this.addEnemyCreatorDebuffRow(d.name, d.effect));
    }

    document.getElementById('enemy-creator-title').innerHTML = `⚡ Gerado: <span style="color:var(--accent-gold);">${monsterName}</span>`;
    
    // Switch to form subtab to view generated monster
    this.switchEnemyCreatorSubTab('form');
    this.showToast(`Monstro <strong>${monsterName}</strong> gerado com sucesso!`);
  }

  saveCustomMonster() {
    const id = document.getElementById('enemy-id').value.trim();
    const name = document.getElementById('enemy-name').value.trim();
    const hp = parseInt(document.getElementById('enemy-hp').value) || 10;
    const ac = parseInt(document.getElementById('enemy-ac').value) || 10;
    const init = parseInt(document.getElementById('enemy-init').value) || 0;
    const rm = parseInt(document.getElementById('enemy-rm').value) || 0;
    const level = parseInt(document.getElementById('enemy-level').value) || 1;
    const actions = parseInt(document.getElementById('enemy-actions').value) || 1;
    const fort = parseInt(document.getElementById('enemy-save-fort').value) || 0;
    const ref = parseInt(document.getElementById('enemy-save-ref').value) || 0;
    const will = parseInt(document.getElementById('enemy-save-will').value) || 0;
    const weapons = this.enemyCreatorSelectedWeapons || [];
    const spells = this.enemyCreatorSelectedSpells || [];
    const specials = this.enemyCreatorSelectedSpecials || [];
    const avatar = document.getElementById('enemy-avatar-url').value.trim() || 'rpg-icon.png';

    const attrStr = parseInt(document.getElementById('enemy-attr-str')?.value) || 10;
    const attrDex = parseInt(document.getElementById('enemy-attr-dex')?.value) || 10;
    const attrCon = parseInt(document.getElementById('enemy-attr-con')?.value) || 10;
    const attrInt = parseInt(document.getElementById('enemy-attr-int')?.value) || 10;
    const attrWis = parseInt(document.getElementById('enemy-attr-wis')?.value) || 10;
    const attrCha = parseInt(document.getElementById('enemy-attr-cha')?.value) || 10;

    // Parse Buffs
    const buffs = [];
    document.querySelectorAll('.enemy-creator-buff-row').forEach(row => {
      const bName = row.querySelector('.buff-name').value.trim();
      const bEffect = row.querySelector('.buff-effect').value.trim();
      if (bName) {
        buffs.push({ name: bName, effect: bEffect });
      }
    });

    // Parse Debuffs
    const debuffs = [];
    document.querySelectorAll('.enemy-creator-debuff-row').forEach(row => {
      const dName = row.querySelector('.debuff-name').value.trim();
      const dEffect = row.querySelector('.debuff-effect').value.trim();
      if (dName) {
        debuffs.push({ name: dName, effect: dEffect });
      }
    });

    const monsterData = {
      name: name,
      baseHp: hp,
      baseAc: ac,
      baseInitMod: init,
      rm: rm,
      level: level,
      baseHD: level,
      actionsMax: actions,
      saves: { fort: fort, ref: ref, will: will },
      attributes: { str: attrStr, dex: attrDex, con: attrCon, int: attrInt, wis: attrWis, cha: attrCha },
      weapons: weapons,
      spells: spells,
      specials: specials,
      buffs: buffs,
      debuffs: debuffs,
      avatar: avatar,
      owner: this.currentUser ? this.currentUser.username : 'Mestre',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
      // Update
      db.collection('custom_monsters').doc(id).set(monsterData, { merge: true })
        .then(() => {
          this.logAction(`Mestre editou o monstro customizado: ${name}`);
          this.clearEnemyCreatorForm();
        })
        .catch(err => {
          console.error("Erro ao editar monstro: ", err);
          alert("Erro ao salvar no banco de dados.");
        });
    } else {
      // Create
      db.collection('custom_monsters').add(monsterData)
        .then(() => {
          this.logAction(`Mestre criou o monstro customizado: ${name}`);
          this.clearEnemyCreatorForm();
        })
        .catch(err => {
          console.error("Erro ao criar monstro: ", err);
          alert("Erro ao salvar no banco de dados.");
        });
    }
  }

  renderCustomMonstersList() {
    const listContainer = document.getElementById('custom-monsters-list-container');
    if (!listContainer) return;

    const searchQuery = (document.getElementById('enemy-list-search')?.value || '').toLowerCase().trim();
    const filtered = this.customMonsters.filter(m => !searchQuery || m.name.toLowerCase().includes(searchQuery));

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-muted); font-size:0.85rem;">Nenhum monstro encontrado.</div>`;
      return;
    }

    listContainer.innerHTML = filtered.map(m => {
      const buffsCount = m.buffs ? m.buffs.length : 0;
      const debuffsCount = m.debuffs ? m.debuffs.length : 0;
      const imgUrl = m.avatar || 'rpg-icon.png';
      const filterStyle = this.getMonsterImageFilter(m.name);

      return `
        <div class="rpg-card" style="padding: 10px; display:flex; gap:10px; align-items:center; background: rgba(255,255,255,0.02); border: 1px solid rgba(212,175,55,0.15);">
          <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0;">
            <span style="font-size:0.62rem; font-weight:bold; color:var(--accent-gold); background:rgba(0,0,0,0.4); padding:1px 3px; border-radius:3px; border:1px solid rgba(212,175,55,0.25);">Nvl ${m.level || m.baseHD || 1}</span>
            <img src="${imgUrl}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid rgba(212,175,55,0.3); ${filterStyle}" alt="${m.name}">
          </div>
          <div style="flex:1; text-align:left; font-size:0.8rem; overflow:hidden;">
            <strong style="color:var(--accent-gold); font-size:0.9rem; display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${m.name}</strong>
            <div><strong>HP:</strong> ${m.baseHp} | <strong>CA:</strong> ${m.baseAc} | <strong>Ini:</strong> ${m.baseInitMod !== undefined ? (m.baseInitMod >= 0 ? `+${m.baseInitMod}` : m.baseInitMod) : '+0'} ${m.rm ? `| <strong>RM:</strong> ${m.rm}` : ''}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">Buffs: ${buffsCount} | Debuffs: ${debuffsCount}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
            <button type="button" class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; background: linear-gradient(135deg, var(--accent-gold), #854d0e);" onclick="app.loadEnemyIntoForm('${m.id}')">Editar</button>
            <button type="button" class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; background: linear-gradient(135deg, green, #005c00); border:none;" onclick="app.quickAddCustomMonsterToCombat('${m.id}')">⚔️ Inserir</button>
            <button type="button" class="rpg-btn" style="padding:2px 8px; font-size:0.7rem; background:#8b0000; border:none;" onclick="app.deleteCustomMonster('${m.id}')">Excluir</button>
          </div>
        </div>
      `;
    }).join('');
  }

  quickAddCustomMonsterToCombat(monsterId) {
    const m = this.customMonsters.find(mon => mon.id === monsterId);
    if (!m) return;

    this.dmCombatants.push({
      name: `${m.name} (Custom)`,
      type: "npc",
      maxHp: m.baseHp,
      currentHp: m.baseHp,
      ac: m.baseAc,
      rm: m.rm || 0,
      level: m.level || m.baseHD || 1,
      baseHD: m.level || m.baseHD || 1,
      actionsMax: m.actionsMax || 1,
      initMod: m.baseInitMod !== undefined ? m.baseInitMod : 0,
      initRoll: "",
      conditions: [],
      buffs: [],
      customBuffs: m.buffs || [],
      customDebuffs: m.debuffs || [],
      saves: m.saves || { fort: 0, ref: 0, will: 0 },
      attributes: m.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      weapons: Array.isArray(m.weapons) ? m.weapons.join(', ') : (m.weapons || ""),
      attacks: Array.isArray(m.weapons) ? m.weapons.join(', ') : (m.weapons || ""),
      spells: m.spells || "",
      specials: m.specials || "",
      avatar: m.avatar || null
    });

    this.saveCombatState();
    this.renderDMCombatTracker();
    this.logAction(`Mestre adicionou ${m.name} ao combate direto do Criador de Inimigos.`);
    alert(`${m.name} foi adicionado à batalha!`);
  }

  loadEnemyIntoForm(monsterId) {
    const m = this.customMonsters.find(mon => mon.id === monsterId);
    if (!m) return;

    document.getElementById('enemy-id').value = m.id;
    document.getElementById('enemy-name').value = m.name;
    document.getElementById('enemy-hp').value = m.baseHp;
    document.getElementById('enemy-ac').value = m.baseAc;
    document.getElementById('enemy-init').value = m.baseInitMod !== undefined ? m.baseInitMod : 0;
    document.getElementById('enemy-rm').value = m.rm || 0;
    document.getElementById('enemy-level').value = m.level || m.baseHD || 1;
    document.getElementById('enemy-actions').value = m.actionsMax || 1;
    
    document.getElementById('enemy-save-fort').value = (m.saves && m.saves.fort) || 0;
    document.getElementById('enemy-save-ref').value = (m.saves && m.saves.ref) || 0;
    document.getElementById('enemy-save-will').value = (m.saves && m.saves.will) || 0;
    
    const attrs = m.attributes || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    if (document.getElementById('enemy-attr-str')) document.getElementById('enemy-attr-str').value = attrs.str;
    if (document.getElementById('enemy-attr-dex')) document.getElementById('enemy-attr-dex').value = attrs.dex;
    if (document.getElementById('enemy-attr-con')) document.getElementById('enemy-attr-con').value = attrs.con;
    if (document.getElementById('enemy-attr-int')) document.getElementById('enemy-attr-int').value = attrs.int;
    if (document.getElementById('enemy-attr-wis')) document.getElementById('enemy-attr-wis').value = attrs.wis;
    if (document.getElementById('enemy-attr-cha')) document.getElementById('enemy-attr-cha').value = attrs.cha;

    document.getElementById('enemy-avatar-url').value = m.avatar || "";

    if (Array.isArray(m.weapons)) {
      this.enemyCreatorSelectedWeapons = m.weapons.map(w => {
        if (typeof w === 'string') return this.parseOldWeaponString(w);
        return w;
      });
    } else if (typeof m.weapons === 'string' && m.weapons.trim()) {
      this.enemyCreatorSelectedWeapons = m.weapons.split(',').map(w => this.parseOldWeaponString(w.trim())).filter(Boolean);
    } else {
      this.enemyCreatorSelectedWeapons = [];
    }
    this.renderEnemyCreatorWeapons();

    if (Array.isArray(m.spells)) {
      this.enemyCreatorSelectedSpells = [...m.spells];
    } else if (typeof m.spells === 'string' && m.spells.trim()) {
      this.enemyCreatorSelectedSpells = m.spells.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      this.enemyCreatorSelectedSpells = [];
    }
    this.renderEnemyCreatorSpells();

    if (Array.isArray(m.specials)) {
      this.enemyCreatorSelectedSpecials = [...m.specials];
    } else if (typeof m.specials === 'string' && m.specials.trim()) {
      this.enemyCreatorSelectedSpecials = m.specials.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      this.enemyCreatorSelectedSpecials = [];
    }
    this.renderEnemyCreatorSpecials();

    const avatarPreview = document.getElementById('enemy-avatar-preview');
    if (avatarPreview) {
      avatarPreview.src = m.avatar || 'rpg-icon.png';
    }

    // Clear and build buffs rows
    const buffsList = document.getElementById('enemy-creator-buffs-list');
    if (buffsList) {
      buffsList.innerHTML = "";
      if (m.buffs) {
        m.buffs.forEach(b => this.addEnemyCreatorBuffRow(b.name, b.effect));
      }
    }

    // Clear and build debuffs rows
    const debuffsList = document.getElementById('enemy-creator-debuffs-list');
    if (debuffsList) {
      debuffsList.innerHTML = "";
      if (m.debuffs) {
        m.debuffs.forEach(d => this.addEnemyCreatorDebuffRow(d.name, d.effect));
      }
    }

    // Switch to form tab if editing
    this.switchEnemyCreatorSubTab('form');

    document.getElementById('enemy-creator-title').innerHTML = `📝 Editando: <span style="color:var(--accent-gold);">${m.name}</span>`;
  }

  clearEnemyCreatorForm() {
    document.getElementById('enemy-id').value = "";
    document.getElementById('enemy-name').value = "";
    document.getElementById('enemy-hp').value = "";
    document.getElementById('enemy-ac').value = "";
    document.getElementById('enemy-init').value = "";
    document.getElementById('enemy-rm').value = "";
    document.getElementById('enemy-level').value = "";
    document.getElementById('enemy-actions').value = "";
    
    document.getElementById('enemy-save-fort').value = "";
    document.getElementById('enemy-save-ref').value = "";
    document.getElementById('enemy-save-will').value = "";
    
    if (document.getElementById('enemy-attr-str')) document.getElementById('enemy-attr-str').value = "10";
    if (document.getElementById('enemy-attr-dex')) document.getElementById('enemy-attr-dex').value = "10";
    if (document.getElementById('enemy-attr-con')) document.getElementById('enemy-attr-con').value = "10";
    if (document.getElementById('enemy-attr-int')) document.getElementById('enemy-attr-int').value = "10";
    if (document.getElementById('enemy-attr-wis')) document.getElementById('enemy-attr-wis').value = "10";
    if (document.getElementById('enemy-attr-cha')) document.getElementById('enemy-attr-cha').value = "10";
    
    document.getElementById('enemy-weapon-name').value = "";
    document.getElementById('enemy-weapon-atk').value = "";
    document.getElementById('enemy-weapon-dice-count').value = "";
    document.getElementById('enemy-weapon-dice-size').value = "8";
    document.getElementById('enemy-weapon-dmg-bonus').value = "";
    document.getElementById('enemy-weapon-magic-bonus').value = "";
    document.getElementById('enemy-weapon-effect').value = "";
    this.enemyCreatorSelectedWeapons = [];
    this.renderEnemyCreatorWeapons();
    
    document.getElementById('enemy-spell-input').value = "";
    this.enemyCreatorSelectedSpells = [];
    this.renderEnemyCreatorSpells();
    
    document.getElementById('enemy-special-input').value = "";
    this.enemyCreatorSelectedSpecials = [];
    this.renderEnemyCreatorSpecials();
    
    document.getElementById('enemy-avatar-url').value = "";

    const avatarPreview = document.getElementById('enemy-avatar-preview');
    if (avatarPreview) {
      avatarPreview.src = 'rpg-icon.png';
    }

    const buffsList = document.getElementById('enemy-creator-buffs-list');
    if (buffsList) buffsList.innerHTML = "";

    const debuffsList = document.getElementById('enemy-creator-debuffs-list');
    if (debuffsList) debuffsList.innerHTML = "";

    document.getElementById('enemy-creator-title').innerHTML = "👿 Criador de Inimigos";
  }

  deleteCustomMonster(monsterId) {
    const m = this.customMonsters.find(mon => mon.id === monsterId);
    if (!m) return;

    if (confirm(`Tem certeza que deseja excluir permanentemente o monstro "${m.name}"?`)) {
      db.collection('custom_monsters').doc(monsterId).delete()
        .then(() => {
          this.logAction(`Mestre excluiu o monstro customizado: ${m.name}`);
        })
        .catch(err => {
          console.error("Erro ao deletar monstro: ", err);
          alert("Erro ao deletar monstro no banco de dados.");
        });
    }
  }

  toggleCustomBuff(cIdx, buffName) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    if (!c.buffs) c.buffs = [];
    const idx = c.buffs.indexOf(buffName);
    if (idx !== -1) {
      c.buffs.splice(idx, 1);
    } else {
      c.buffs.push(buffName);
    }

    this.saveCombatState();
    this.dmManageBuffsModal(cIdx);
    this.renderDMCombatTracker();
  }

  toggleCustomDebuff(cIdx, debuffName) {
    const c = this.dmCombatants[cIdx];
    if (!c) return;

    if (!c.conditions) c.conditions = [];
    const idx = c.conditions.indexOf(debuffName);
    if (idx !== -1) {
      c.conditions.splice(idx, 1);
    } else {
      c.conditions.push(debuffName);
    }

    this.saveCombatState();
    this.dmManageConditionsModal(cIdx);
    this.renderDMCombatTracker();
  }

  getModifiedMonsterStats(m) {
    let hpMod = 0;
    let acMod = 0;
    let rmMod = 0;
    let fortMod = 0;
    let refMod = 0;
    let willMod = 0;

    const parseEffect = (effectStr) => {
      if (!effectStr) return;
      const parts = effectStr.toLowerCase().split(',');
      parts.forEach(part => {
        const match = part.trim().match(/^([+-]\d+)\s+(\w+)/);
        if (match) {
          const val = parseInt(match[1]);
          const stat = match[2];
          if (stat === 'ca' || stat === 'ac') acMod += val;
          else if (stat === 'hp') hpMod += val;
          else if (stat === 'rm' || stat === 'sr') rmMod += val;
          else if (stat === 'fort' || stat === 'fortitude') fortMod += val;
          else if (stat === 'ref' || stat === 'reflexos' || stat === 'reflex') refMod += val;
          else if (stat === 'will' || stat === 'vontade' || stat === 'vont') willMod += val;
        }
      });
    };

    if (m.buffs && m.customBuffs) {
      m.buffs.forEach(activeBuffName => {
        const found = m.customBuffs.find(b => b.name === activeBuffName);
        if (found) parseEffect(found.effect);
      });
    }

    if (m.conditions && m.customDebuffs) {
      m.conditions.forEach(activeDebuffName => {
        const found = m.customDebuffs.find(d => d.name === activeDebuffName);
        if (found) parseEffect(found.effect);
      });
    }

    return {
      ac: m.ac + acMod,
      maxHp: m.maxHp + hpMod,
      currentHp: m.currentHp,
      rm: (m.rm || 0) + rmMod,
      saves: {
        fort: ((m.saves && m.saves.fort) || 0) + fortMod,
        ref: ((m.saves && m.saves.ref) || 0) + refMod,
        will: ((m.saves && m.saves.will) || 0) + willMod
      }
    };
  }

  switchEnemyCreatorSubTab(tab) {
    const btnForm = document.getElementById('enemy-creator-btn-form');
    const btnList = document.getElementById('enemy-creator-btn-list');
    const paneForm = document.getElementById('enemy-creator-pane-form');
    const paneList = document.getElementById('enemy-creator-pane-list');

    if (tab === 'form') {
      if (btnForm) btnForm.classList.remove('rpg-btn-secondary');
      if (btnList) btnList.classList.add('rpg-btn-secondary');
      if (paneForm) paneForm.style.display = 'block';
      if (paneList) paneList.style.display = 'none';
    } else {
      if (btnForm) btnForm.classList.add('rpg-btn-secondary');
      if (btnList) btnList.classList.remove('rpg-btn-secondary');
      if (paneForm) paneForm.style.display = 'none';
      if (paneList) paneList.style.display = 'flex';
      this.renderCustomMonstersList();
    }
  }

  onEnemyAvatarFileSelected(input) {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 128;
          const MAX_HEIGHT = 128;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          } else {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }

          canvas.width = MAX_WIDTH;
          canvas.height = MAX_HEIGHT;
          const ctx = canvas.getContext('2d');
          
          const xOffset = (MAX_WIDTH - width) / 2;
          const yOffset = (MAX_HEIGHT - height) / 2;
          ctx.drawImage(img, xOffset, yOffset, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

          const urlInput = document.getElementById('enemy-avatar-url');
          if (urlInput) {
            urlInput.value = dataUrl;
          }
          const avatarPreview = document.getElementById('enemy-avatar-preview');
          if (avatarPreview) {
            avatarPreview.src = dataUrl;
          }
          this.showToast("Imagem local carregada e otimizada!");
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  populateEnemyCreatorSpellSuggestions() {
    const datalist = document.getElementById('spell-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    Object.values(window.DND3_SpellDatabase || {}).forEach(spell => {
      const opt = document.createElement('option');
      opt.value = spell.name.trim();
      datalist.appendChild(opt);
    });
  }

  addEnemyCreatorTypedSpell() {
    const input = document.getElementById('enemy-spell-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    
    if (!this.enemyCreatorSelectedSpells) {
      this.enemyCreatorSelectedSpells = [];
    }
    const lowerVal = val.toLowerCase();
    const exists = this.enemyCreatorSelectedSpells.some(s => s.toLowerCase() === lowerVal);
    if (!exists) {
      const dbSpell = Object.values(window.DND3_SpellDatabase || {}).find(s => s.name.trim().toLowerCase() === lowerVal);
      const spellName = dbSpell ? dbSpell.name.trim() : val;
      
      this.enemyCreatorSelectedSpells.push(spellName);
      this.renderEnemyCreatorSpells();
      input.value = '';
    } else {
      this.showToast("Magia já adicionada!");
    }
  }

  removeEnemyCreatorSpell(spellName) {
    if (!this.enemyCreatorSelectedSpells) return;
    this.enemyCreatorSelectedSpells = this.enemyCreatorSelectedSpells.filter(s => s !== spellName);
    this.renderEnemyCreatorSpells();
  }

  renderEnemyCreatorSpells() {
    const container = document.getElementById('enemy-creator-spells-list');
    if (!container) return;
    
    if (!this.enemyCreatorSelectedSpells || this.enemyCreatorSelectedSpells.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted); font-size:0.72rem; padding: 2px 4px;">Nenhuma magia adicionada.</span>';
      return;
    }
    
    container.innerHTML = this.enemyCreatorSelectedSpells.map(s => `
      <span class="rpg-status-badge" style="display:inline-flex; align-items:center; gap:6px; font-size:0.72rem; background:rgba(212,175,55,0.15); border:1px solid var(--accent-gold); padding:2px 8px; border-radius:12px; color:var(--text-parchment);">
        ${s}
        <span style="color:#ff4444; cursor:pointer; font-weight:bold; font-size:0.95rem; line-height:1;" onclick="app.removeEnemyCreatorSpell('${s.replace(/'/g, "\\'")}')">&times;</span>
      </span>
    `).join('');
  }

  populateEnemyCreatorSpecialSuggestions() {
    const datalist = document.getElementById('special-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    const uniqueSpecials = new Set();
    uniqueSpecials.add("Visão no Escuro 18m");
    uniqueSpecials.add("Faro");
    uniqueSpecials.add("Regeneração 5");
    uniqueSpecials.add("Imunidade a Fogo");
    uniqueSpecials.add("Imunidade a Frio");
    uniqueSpecials.add("Imunidade a Eletricidade");
    uniqueSpecials.add("Imunidade a Ácido");
    uniqueSpecials.add("Redução de Dano 10/+1");
    uniqueSpecials.add("Presença Aterradora (CD 20)");
    uniqueSpecials.add("Sopro de Fogo (10d6, CD 20)");
    uniqueSpecials.add("Agarramento Aprimorado");
    uniqueSpecials.add("Constrição");
    uniqueSpecials.add("Bote");
    
    Object.values(window.DND3_Monsters || {}).forEach(m => {
      const specStr = m.specials || m.specialAbilities || '';
      if (specStr) {
        specStr.split(',').forEach(s => {
          const clean = s.trim();
          if (clean && clean.length > 2) uniqueSpecials.add(clean);
        });
      }
    });
    
    Array.from(uniqueSpecials).sort().forEach(spec => {
      const opt = document.createElement('option');
      opt.value = spec;
      datalist.appendChild(opt);
    });
  }

  addEnemyCreatorTypedSpecial() {
    const input = document.getElementById('enemy-special-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    
    if (!this.enemyCreatorSelectedSpecials) {
      this.enemyCreatorSelectedSpecials = [];
    }
    const lowerVal = val.toLowerCase();
    const exists = this.enemyCreatorSelectedSpecials.some(s => s.toLowerCase() === lowerVal);
    if (!exists) {
      this.enemyCreatorSelectedSpecials.push(val);
      this.renderEnemyCreatorSpecials();
      input.value = '';
    } else {
      this.showToast("Habilidade já adicionada!");
    }
  }

  removeEnemyCreatorSpecial(specialName) {
    if (!this.enemyCreatorSelectedSpecials) return;
    this.enemyCreatorSelectedSpecials = this.enemyCreatorSelectedSpecials.filter(s => s !== specialName);
    this.renderEnemyCreatorSpecials();
  }

  renderEnemyCreatorSpecials() {
    const container = document.getElementById('enemy-creator-specials-list');
    if (!container) return;
    
    if (!this.enemyCreatorSelectedSpecials || this.enemyCreatorSelectedSpecials.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted); font-size:0.72rem; padding: 2px 4px;">Nenhuma habilidade especial adicionada.</span>';
      return;
    }
    
    container.innerHTML = this.enemyCreatorSelectedSpecials.map(s => `
      <span class="rpg-status-badge" style="display:inline-flex; align-items:center; gap:6px; font-size:0.72rem; background:rgba(212,175,55,0.15); border:1px solid var(--accent-gold); padding:2px 8px; border-radius:12px; color:var(--text-parchment);">
        ${s}
        <span style="color:#ff4444; cursor:pointer; font-weight:bold; font-size:0.95rem; line-height:1;" onclick="app.removeEnemyCreatorSpecial('${s.replace(/'/g, "\\'")}')">&times;</span>
      </span>
    `).join('');
  }

  populateEnemyCreatorWeaponSuggestions() {
    const datalist = document.getElementById('weapon-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    const uniqueWeapons = new Set();
    uniqueWeapons.add("Espada Longa (1d8)");
    uniqueWeapons.add("Espada Grande (2d6)");
    uniqueWeapons.add("Espada Curta (1d6)");
    uniqueWeapons.add("Adaga (1d4)");
    uniqueWeapons.add("Arco Longo (1d8)");
    uniqueWeapons.add("Besta Leve (1d8)");
    uniqueWeapons.add("Garras (1d6)");
    uniqueWeapons.add("Mordida (1d6)");
    uniqueWeapons.add("Pancada (1d6)");
    uniqueWeapons.add("Grande Clava (1d10)");
    
    Object.values(window.DND3_Monsters || {}).forEach(m => {
      const atkStr = m.weapons || m.attacks || '';
      if (atkStr) {
        atkStr.split(/(?: e | ou |,)/).forEach(w => {
          const clean = w.trim();
          if (clean && clean.length > 2) uniqueWeapons.add(clean);
        });
      }
    });
    
    Array.from(uniqueWeapons).sort().forEach(w => {
      const opt = document.createElement('option');
      opt.value = w;
      datalist.appendChild(opt);
    });
  }

  parseCritString(critStr) {
    let range = 20;
    let mult = 2;
    if (!critStr || typeof critStr !== 'string') return { range, mult };

    const rangeMatch = critStr.match(/(\d{2})(?:\s*-\s*20)?/);
    if (rangeMatch) {
      const val = parseInt(rangeMatch[1]);
      if (val >= 1 && val <= 20) {
        range = val;
      }
    }

    const multMatch = critStr.match(/x\s*(\d+)/i);
    if (multMatch) {
      mult = parseInt(multMatch[1]) || 2;
    }

    return { range, mult };
  }

  dmSelectNpcWeapon(selectEl) {
    const opt = selectEl.options[selectEl.selectedIndex];
    if (!opt || !opt.value) return;
    
    const atk = opt.getAttribute('data-atk');
    const dmg = opt.getAttribute('data-damage') || "1d6";
    const crit = opt.getAttribute('data-crit') || "20/x2";
    
    const atkBonusInput = document.getElementById('action-npc-atk-bonus');
    const dmgDiceInput = document.getElementById('action-npc-dmg-dice');
    const dmgBonusInput = document.getElementById('action-npc-dmg-bonus');
    const critInput = document.getElementById('action-npc-crit');
    
    if (atkBonusInput && atk !== null) atkBonusInput.value = atk;
    if (critInput) critInput.value = crit;
    
    // Parse dmg string like "4d8+15" or "1d8" into dice part and bonus part
    const dmgMatch = dmg.match(/(\d+d\d+)(?:([+-]\d+))?/);
    if (dmgMatch) {
      if (dmgDiceInput) dmgDiceInput.value = dmgMatch[1];
      if (dmgBonusInput) {
        dmgBonusInput.value = dmgMatch[2] ? parseInt(dmgMatch[2]) : 0;
      }
    } else {
      if (dmgDiceInput) dmgDiceInput.value = dmg;
      if (dmgBonusInput) dmgBonusInput.value = 0;
    }
  }

  formatWeaponsText(weapons) {
    if (!weapons) return "Nenhum";
    if (typeof weapons === 'string') return weapons;
    if (Array.isArray(weapons)) {
      return weapons.map(w => {
        if (typeof w === 'string') return w;
        const totalAtk = (parseInt(w.atkBonus)||0) + (parseInt(w.magicBonus)||0);
        const totalDmgBonus = (parseInt(w.dmgBonus)||0) + (parseInt(w.magicBonus)||0);
        const totalAtkStr = totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`;
        const totalDmgBonusStr = totalDmgBonus > 0 ? `+${totalDmgBonus}` : (totalDmgBonus < 0 ? `${totalDmgBonus}` : '');
        const critStr = w.critical ? `, Crit: ${w.critical}` : '';
        const effectStr = w.effect ? `, ${w.effect}` : '';
        return `${w.name} ${totalAtkStr} (${w.diceCount || 1}d${w.diceSize || 8}${totalDmgBonusStr}${critStr}${effectStr})`;
      }).join(', ');
    }
    return "Nenhum";
  }

  parseOldWeaponString(w) {
    if (!w) return null;
    let name = w.trim();
    let atkBonus = 0;
    let diceCount = 1;
    let diceSize = 8;
    let dmgBonus = 0;
    let magicBonus = 0;
    let effect = "";
    let critical = "20/x2";

    // 0. Extract critical range/mult if specified
    const critMatch = w.match(/(?:crit|crítico)?\s*(\d{2}(?:-\d{2})?\/x\d+|x\d+)/i);
    if (critMatch) {
      critical = critMatch[1].trim();
    }

    // 1. Try to extract effect if there's a comma inside parenthesis
    const parenMatch = w.match(/\((.*?)\)/);
    let parenContent = "";
    if (parenMatch) {
      parenContent = parenMatch[1];
      const parts = parenContent.split(',');
      if (parts.length > 1) {
        effect = parts.slice(1).filter(p => !p.toLowerCase().includes('crit')).join(',').trim();
      }
    }

    // 2. Extract attack bonus
    let atkMatch = null;
    if (parenContent && parenContent.includes('|')) {
      const parts = parenContent.split('|');
      atkMatch = parts[0].match(/([+-]\d+)/);
    }
    if (!atkMatch) {
      const outside = w.replace(/\(.*?\)/g, '').trim();
      atkMatch = outside.match(/([+-]\d+)/);
    }
    if (atkMatch) {
      atkBonus = parseInt(atkMatch[1]) || 0;
    }

    // 3. Extract damage dice and bonus
    const dmgMatch = w.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
    if (dmgMatch) {
      diceCount = parseInt(dmgMatch[1]) || 1;
      diceSize = parseInt(dmgMatch[2]) || 8;
      if (dmgMatch[3] && dmgMatch[4]) {
        const sign = dmgMatch[3];
        const val = parseInt(dmgMatch[4]) || 0;
        dmgBonus = sign === '+' ? val : -val;
      }
    }

    // 4. Clean up name
    let cleanName = w.replace(/\(.*?\)/g, '');
    cleanName = cleanName.replace(/[+-]\d+/g, '');
    cleanName = cleanName.replace(/corpo a corpo|à distância|distância/gi, '');
    cleanName = cleanName.replace(/[\s|,]+/g, ' ').trim();

    if (effect && (cleanName === "" || cleanName.toLowerCase() === "corpo a corpo" || cleanName.toLowerCase() === "à distância")) {
      name = effect;
      effect = "";
    } else {
      name = cleanName || "Ataque";
    }

    return {
      name: name,
      atkBonus: atkBonus,
      diceCount: diceCount,
      diceSize: diceSize,
      dmgBonus: dmgBonus,
      magicBonus: magicBonus,
      effect: effect,
      critical: critical
    };
  }

  addEnemyCreatorWeapon() {
    const nameInput = document.getElementById('enemy-weapon-name');
    const atkInput = document.getElementById('enemy-weapon-atk');
    const countInput = document.getElementById('enemy-weapon-dice-count');
    const sizeInput = document.getElementById('enemy-weapon-dice-size');
    const dmgBonusInput = document.getElementById('enemy-weapon-dmg-bonus');
    const magicInput = document.getElementById('enemy-weapon-magic-bonus');
    const effectInput = document.getElementById('enemy-weapon-effect');
    const critInput = document.getElementById('enemy-weapon-crit');

    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) {
      this.showToast("Informe o nome da arma/ataque!");
      return;
    }

    if (!this.enemyCreatorSelectedWeapons) {
      this.enemyCreatorSelectedWeapons = [];
    }

    const newWeapon = {
      name: name,
      atkBonus: parseInt(atkInput.value) || 0,
      diceCount: parseInt(countInput.value) || 1,
      diceSize: parseInt(sizeInput.value) || 8,
      dmgBonus: parseInt(dmgBonusInput.value) || 0,
      magicBonus: parseInt(magicInput.value) || 0,
      effect: effectInput ? effectInput.value.trim() : "",
      critical: critInput ? (critInput.value.trim() || "20/x2") : "20/x2"
    };

    this.enemyCreatorSelectedWeapons.push(newWeapon);
    this.renderEnemyCreatorWeapons();

    // Clear inputs
    nameInput.value = "";
    atkInput.value = "0";
    countInput.value = "1";
    sizeInput.value = "8";
    dmgBonusInput.value = "0";
    magicInput.value = "0";
    if (effectInput) effectInput.value = "";
    if (critInput) critInput.value = "20/x2";
  }

  removeEnemyCreatorWeapon(idx) {
    if (!this.enemyCreatorSelectedWeapons) return;
    this.enemyCreatorSelectedWeapons.splice(idx, 1);
    this.renderEnemyCreatorWeapons();
  }

  renderEnemyCreatorWeapons() {
    const container = document.getElementById('enemy-creator-weapons-list');
    if (!container) return;
    
    if (!this.enemyCreatorSelectedWeapons || this.enemyCreatorSelectedWeapons.length === 0) {
      container.innerHTML = '<span style="color:var(--text-muted); font-size:0.72rem; padding: 2px 4px;">Nenhuma arma ou ataque adicionado.</span>';
      return;
    }
    
    container.innerHTML = this.enemyCreatorSelectedWeapons.map((w, idx) => {
      const totalAtk = (parseInt(w.atkBonus)||0) + (parseInt(w.magicBonus)||0);
      const totalDmgBonus = (parseInt(w.dmgBonus)||0) + (parseInt(w.magicBonus)||0);
      const totalAtkStr = totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`;
      const totalDmgBonusStr = totalDmgBonus > 0 ? `+${totalDmgBonus}` : (totalDmgBonus < 0 ? `${totalDmgBonus}` : '');
      const critStr = w.critical ? `, Crit: ${w.critical}` : '';
      const effectStr = w.effect ? `, ${w.effect}` : '';
      const dispText = `${w.name} ${totalAtkStr} (${w.diceCount || 1}d${w.diceSize || 8}${totalDmgBonusStr}${critStr}${effectStr})`;
      
      return `
        <span class="rpg-status-badge" style="display:inline-flex; align-items:center; gap:6px; font-size:0.72rem; background:rgba(212,175,55,0.15); border:1px solid var(--accent-gold); padding:2px 8px; border-radius:12px; color:var(--text-parchment);">
          ${dispText}
          <span style="color:#ff4444; cursor:pointer; font-weight:bold; font-size:0.95rem; line-height:1;" onclick="app.removeEnemyCreatorWeapon(${idx})">&times;</span>
        </span>
      `;
    }).join('');
  }

  // ===========================================================================
  // IMPORTAR / EXPORTAR FICHA DE PERSONAGEM - PLANILHA EXCEL (.xlsx)
  // Funciona em PC e CELULAR (iOS e Android via SheetJS)
  // ===========================================================================

  importCharacterFromExcel(event) {
    if (!window.XLSX) {
      this.showToast('❌ Biblioteca de leitura de Excel não carregou. Recarregue a página.');
      return;
    }

    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Reseta o input para permitir reimportar o mesmo arquivo
    event.target.value = '';

    this.showToast('📥 Lendo planilha... Aguarde.');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        // Lê aba "Frente" (primeira aba da ficha)
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];

        // Helper para ler valor de célula com segurança
        const cell = (ref) => {
          const c = ws[ref];
          if (!c) return '';
          // Retorna valor já processado (número ou texto)
          return c.v !== undefined ? c.v : '';
        };
        const str = (ref) => String(cell(ref) || '').trim();
        const num = (ref) => parseInt(cell(ref)) || 0;

        // ---- IDENTIFICAÇÃO ----
        const charName    = str('A1')  || str('A5')  || 'Personagem Importado';
        const charRace    = str('BB1') || str('BB5') || '';
        const alignment   = str('BU1') || str('BU5') || 'tn';
        const deity       = str('CL1') || str('CL5') || '';
        const charClass   = str('A8')  || '';
        const charSize    = str('A15') || 'Médio';
        const charAge     = str('N15') || '';
        const charGender  = str('AA15')|| '';
        const charHeight  = str('AN15')|| '';
        const charWeight  = str('BB15')|| '';

        // ---- ATRIBUTOS BASE ----
        // Linha 28=FOR, 34=DEX, 40=CON, 46=INT, 52=SAB, 58=CAR
        // Coluna O = VALOR, V = MODIF, AD = VALOR TEMP, AK = MODIF TEMP
        const strVal  = num('O28');
        const strTemp = num('AD28') || strVal;
        const dexVal  = num('O34');
        const dexTemp = num('AD34') || dexVal;
        const conVal  = num('O40');
        const conTemp = num('AD40') || conVal;
        const intVal  = num('O46');
        const intTemp = num('AD46') || intVal;
        const wisVal  = num('O52');
        const wisTemp = num('AD52') || wisVal;
        const chaVal  = num('O58');
        const chaTemp = num('AD58') || chaVal;

        // ---- COMBATE ----
        const hpMax    = num('BH28') || 10;
        const acTotal  = num('BH34') || 10;
        const initMod  = num('BP53') || 0;
        const fortSave = num('X69')  || 0;
        const refSave  = num('X75')  || 0;
        const willSave = num('X81')  || 0;
        const meleeAtk = num('AD93') || 0;
        const rangeAtk = num('AD99') || 0;

        // ---- ARMAS (linhas 113, 130, 147, 164) ----
        const weapons = [];
        const weaponRows = [
          { nameR: 'A113', atkR: 'AL113', dmgR: 'BH113', critR: 'BX113' },
          { nameR: 'A130', atkR: 'AL130', dmgR: 'BH130', critR: 'BX130' },
          { nameR: 'A147', atkR: 'AL147', dmgR: 'BH147', critR: 'BX147' },
          { nameR: 'A164', atkR: 'AL164', dmgR: 'BH164', critR: 'BX164' },
        ];
        weaponRows.forEach(row => {
          const wName = str(row.nameR);
          if (wName && wName.length > 1) {
            weapons.push({
              name: wName,
              atkBonus: str(row.atkR),
              damage: str(row.dmgR),
              critical: str(row.critR),
              range: '',
              type: '',
              notes: ''
            });
          }
        });

        // ---- VERSO: XP, Talentos, Equipamentos, Observações ----
        let xpVal = 0, featsText = '', inventoryText = '', notes = '', spellsText = '';
        if (wb.SheetNames.length > 1) {
          const ws2 = wb.Sheets[wb.SheetNames[1]];
          const cell2 = (ref) => { const c = ws2[ref]; return c ? c.v : ''; };
          const str2  = (ref) => String(cell2(ref) || '').trim();

          xpVal = parseInt(str2('AJ13')) || 0;

          // Observações e qualidades especiais
          const obs1 = str2('DT4') || '';
          const obs2 = str2('BY4') || '';
          notes = [obs1, obs2].filter(Boolean).join('\n');

          // Talentos (coluna BY, linhas 88-230 a cada 4)
          const featLines = [];
          for (let r = 88; r <= 230; r += 4) {
            const t = str2(`BY${r}`);
            if (t && t.length > 3 && !t.includes('System.Xml')) featLines.push(t);
          }
          featsText = featLines.join(', ');

          // Equipamentos (coluna A, linhas 24-52 a cada 4)
          const eqLines = [];
          for (let r = 24; r <= 52; r += 4) {
            const eq = str2(`A${r}`);
            if (eq && eq.length > 2) eqLines.push(eq);
          }
          inventoryText = eqLines.join(', ');

          // Grimório de magias (aba Spellbook, se existir)
          if (wb.SheetNames.length > 2) {
            const ws3 = wb.Sheets[wb.SheetNames[2]];
            const str3 = (ref) => { const c = ws3[ref]; return c ? String(c.v || '').trim() : ''; };
            const spellLines = [];
            for (let r = 1; r <= 80; r++) {
              const s = str3(`A${r}`) || str3(`B${r}`);
              if (s && s.length > 3 && !s.includes('System.Xml') && !s.includes('Magia') && !s.includes('Nível') && !s.includes('NOME')) {
                spellLines.push(s);
              }
            }
            spellsText = spellLines.filter(Boolean).slice(0, 60).join(', ');
          }
        }

        // ---- Mapear alinhamento ----
        const alignMap = {
          'LB': 'lg', 'L/B': 'lg', 'LG': 'lg', 'NN': 'tn', 'N': 'tn',
          'CN': 'cn', 'LM': 'le', 'L/M': 'le', 'NB': 'ng', 'NM': 'ne',
          'CB': 'cg', 'CM': 'ce', 'LN': 'ln'
        };
        const alignKey = alignment.toUpperCase().replace(/\s/g, '');
        const mappedAlignment = alignMap[alignKey] || 'tn';

        // ---- Detectar raça mais próxima ----
        const raceMap = {
          'humano': 'human', 'human': 'human',
          'elfo': 'elf', 'elf': 'elf',
          'anão': 'dwarf', 'anao': 'dwarf', 'dwarf': 'dwarf',
          'halfling': 'halfling', 'gnomo': 'gnome', 'gnome': 'gnome',
          'meio-elfo': 'half_elf', 'half_elf': 'half_elf', 'meio elfo': 'half_elf',
          'meio-orc': 'half_orc', 'half_orc': 'half_orc', 'meio orc': 'half_orc',
          'meio-dragão': 'half_dragon', 'half dragon': 'half_dragon', 'half_dragon': 'half_dragon',
          'dragão': 'half_dragon', 'dragao': 'half_dragon',
          'aasimar': 'aasimar', 'tiefling': 'tiefling',
          'homem-tigre': 'human', 'homem tigre': 'human',
        };
        const raceKey = (charRace || '').toLowerCase();
        let mappedRace = 'human';
        for (const [k, v] of Object.entries(raceMap)) {
          if (raceKey.includes(k)) { mappedRace = v; break; }
        }

        // ---- Detectar classe ----
        const classMap = {
          'guerreiro': 'fighter', 'fighter': 'fighter',
          'mestre das armas': 'fighter',
          'bárbaro': 'barbarian', 'barbarian': 'barbarian',
          'ladino': 'rogue', 'rogue': 'rogue',
          'rastreador': 'ranger', 'ranger': 'ranger',
          'paladino': 'paladin', 'paladin': 'paladin',
          'monge': 'monk', 'monk': 'monk',
          'clérigo': 'cleric', 'clerigo': 'cleric', 'cleric': 'cleric',
          'druida': 'druid', 'druid': 'druid',
          'mago': 'wizard', 'wizard': 'wizard',
          'feiticeiro': 'sorcerer', 'sorcerer': 'sorcerer',
          'bardo': 'bard', 'bard': 'bard',
        };
        const classKey = (charClass || '').toLowerCase();
        let mappedClass = 'fighter';
        for (const [k, v] of Object.entries(classMap)) {
          if (classKey.includes(k)) { mappedClass = v; break; }
        }

        // ---- Nível estimado a partir do XP ----
        const xpThresholds = [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000,
          55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000,
          210000, 231000, 253000, 276000, 300000, 325000, 351000, 378000, 406000, 435000];
        let estimatedLevel = 1;
        for (let i = xpThresholds.length - 1; i >= 0; i--) {
          if (xpVal >= xpThresholds[i]) { estimatedLevel = i + 1; break; }
        }
        estimatedLevel = Math.max(1, Math.min(30, estimatedLevel));

        // ---- Montar objeto do personagem ----
        const newChar = {
          id: 'char_' + Date.now(),
          name: charName,
          player: this.currentUser ? this.currentUser.username : 'Mestre',
          gender: charGender || 'Não informado',
          race: mappedRace,
          raceDisplay: charRace,
          class: mappedClass,
          classDisplay: charClass,
          alignment: mappedAlignment,
          level: estimatedLevel,
          xp: xpVal,
          xpSessions: xpVal > 0 ? [{ sessionName: 'Importado da Ficha Excel', xpAmt: xpVal }] : [],
          deity: deity,
          size: charSize,
          age: charAge,
          height: charHeight,
          weight: charWeight,
          eyes: '',
          hair: '',
          skin: '',
          abilitiesBase: { str: strVal, dex: dexVal, con: conVal, int: intVal, wis: wisVal, cha: chaVal },
          abilitiesTemp: { str: strTemp !== strVal ? strTemp : '', dex: dexTemp !== dexVal ? dexTemp : '', con: '', int: '', wis: '', cha: chaTemp !== chaVal ? chaTemp : '' },
          hpMax: hpMax,
          currentHp: hpMax,
          dr: '',
          initiativeMods: [],
          initiativeMisc: initMod,
          acArmor: 0,
          acShield: 0,
          acNatural: 0,
          acDeflection: 0,
          acMisc: acTotal - 10,
          acSize: 0,
          saveFortBase: fortSave,
          saveFortMagic: 0,
          saveFortMisc: 0,
          saveFortTemp: 0,
          saveRefBase: refSave,
          saveRefMagic: 0,
          saveRefMisc: 0,
          saveRefTemp: 0,
          saveWillBase: willSave,
          saveWillMagic: 0,
          saveWillMisc: 0,
          saveWillTemp: 0,
          bab: meleeAtk,
          sr: 0,
          grappleSize: 0,
          grappleMisc: 0,
          weapons: weapons,
          skillRanks: {},
          skillMisc: {},
          featsText: featsText,
          customFeats: [],
          customAbilities: [],
          languages: ['Comum'],
          inventoryText: inventoryText,
          coins: { gp: 0, pp: 0, sp: 0, cp: 0 },
          spellsText: spellsText,
          notes: notes || `Personagem importado da planilha Excel: ${file.name}`,
          avatar: '',
          owner: this.currentUser ? this.currentUser.username : 'Mestre',
          importedFrom: file.name,
          updatedAt: new Date().toISOString()
        };

        this.savedCharacters.push(newChar);
        this.saveCharactersState();
        this.logAction(`Importou o personagem: ${newChar.name} (da planilha: ${file.name})`);

        // Abre a aba de fichas e visualiza a ficha recém-importada
        this.switchTab('sheets');
        this.renderSavedSheetsList();
        this.viewCharacterSheet(newChar.id);

        this.showToast(`✅ Personagem <strong>${newChar.name}</strong> importado com sucesso! Revise a ficha.`);

      } catch (err) {
        console.error('Erro ao importar Excel:', err);
        this.showToast('❌ Erro ao ler a planilha. Verifique se o arquivo é uma ficha de D&D 3.5e válida no formato .xlsx.');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  exportCharacterToExcel(charId) {
    if (!window.XLSX) {
      this.showToast('❌ Biblioteca de exportação não carregou. Recarregue a página.');
      return;
    }

    const char = this.savedCharacters.find(c => c.id === charId);
    if (!char) return;

    const mod = (val) => Math.floor((parseInt(val || 0) - 10) / 2);

    const data = [
      ['VALEIROS GUERRENTES - Ficha de Personagem D&D 3.5e', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Nome do Personagem', char.name || '', 'Raça', char.raceDisplay || char.race || '', 'Tendência', char.alignment || '', 'Divindade', char.deity || ''],
      ['Classe', char.classDisplay || char.class || '', 'Nível', char.level || 1, 'XP', char.xp || 0, 'Jogador', char.player || ''],
      ['Tamanho', char.size || '', 'Idade', char.age || '', 'Sexo', char.gender || '', '', ''],
      ['Altura', char.height || '', 'Peso', char.weight || '', 'Olhos', char.eyes || '', 'Cabelo', char.hair || ''],
      ['', '', '', '', '', '', '', ''],
      ['=== ATRIBUTOS ===', '', '', '', '', '', '', ''],
      ['Atributo', 'Valor', 'Modificador', 'Valor Temp', 'Mod. Temp', '', '', ''],
      ['Força (FOR)', char.abilitiesBase?.str || 0, mod(char.abilitiesBase?.str), char.abilitiesTemp?.str || '', '', '', '', ''],
      ['Destreza (DES)', char.abilitiesBase?.dex || 0, mod(char.abilitiesBase?.dex), char.abilitiesTemp?.dex || '', '', '', '', ''],
      ['Constituição (CON)', char.abilitiesBase?.con || 0, mod(char.abilitiesBase?.con), '', '', '', '', ''],
      ['Inteligência (INT)', char.abilitiesBase?.int || 0, mod(char.abilitiesBase?.int), '', '', '', '', ''],
      ['Sabedoria (SAB)', char.abilitiesBase?.wis || 0, mod(char.abilitiesBase?.wis), '', '', '', '', ''],
      ['Carisma (CAR)', char.abilitiesBase?.cha || 0, mod(char.abilitiesBase?.cha), char.abilitiesTemp?.cha || '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['=== COMBATE ===', '', '', '', '', '', '', ''],
      ['PV Máximo', char.hpMax || 0, 'PV Atual', char.currentHp || 0, 'CA', (10 + (char.acArmor||0) + (char.acShield||0) + (char.acDeflection||0) + (char.acMisc||0)), 'Iniciativa', char.initiativeMisc || 0],
      ['Fortitude', char.saveFortBase || 0, 'Reflexos', char.saveRefBase || 0, 'Vontade', char.saveWillBase || 0, 'BAB', char.bab || 0],
      ['', '', '', '', '', '', '', ''],
      ['=== ARMAS ===', '', '', '', '', '', '', ''],
      ['Nome', 'Bônus de Ataque', 'Dano', 'Decisivo', 'Alcance', 'Tipo', 'Notas', ''],
      ...(char.weapons || []).map(w => [w.name || '', w.atkBonus || '', w.damage || '', w.critical || '', w.range || '', w.type || '', w.notes || '', '']),
      ['', '', '', '', '', '', '', ''],
      ['=== TALENTOS ===', '', '', '', '', '', '', ''],
      [char.featsText || '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['=== INVENTÁRIO / EQUIPAMENTOS ===', '', '', '', '', '', '', ''],
      [char.inventoryText || '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['=== MAGIAS ===', '', '', '', '', '', '', ''],
      [char.spellsText || '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['=== OBSERVAÇÕES ===', '', '', '', '', '', '', ''],
      [char.notes || '', '', '', '', '', '', '', ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Largura das colunas
    ws['!cols'] = [
      { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 20 },
      { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ficha');

    const fileName = `${char.name || 'personagem'}_valeiros_guerrentes.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, fileName);

    this.showToast(`📤 Ficha de <strong>${char.name}</strong> exportada para Excel com sucesso!`);
  }
}

// Global App Instance
window.app = new DnD3App();
