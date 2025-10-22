// script.js

// -------------------------------------------------------------
// 1. IMPORTAÇÕES E REFERÊNCIAS GLOBAIS
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// !!! CONFIGURAÇÃO DO FIREBASE (CRÍTICO: SUBSTITUA PELOS SEUS DADOS) !!!
const firebaseConfig = {
    apiKey: "AIzaSyBwX2RJ8mSLVoam5VQ6iUru_xFS-5tMK5Q",
    authDomain: "sistema-escolar-15de4.firebaseapp.com",
    projectId: "sistema-escolar-15de4",
    storageBucket: "sistema-escolar-15de4.firebasestorage.app",
    messagingSenderId: "836027531969",
    appId: "1:836027531969:web:b5a7d1d40ab0dfa164ca40",
    measurementId: "G-0YX1D9YR42"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Referências das Coleções
const alunosCol = collection(db, "alunos");
const notasCol = collection(db, "notas");
const comunicadosCol = collection(db, "comunicados");

// Variável global para armazenar os dados do aluno em exibição no modal
let alunoDetalhesData = null;

// Referências de Elementos do DOM
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const authTitle = document.getElementById('auth-title');
const authForm = document.getElementById('auth-form');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authFeedback = document.getElementById('auth-feedback');
const switchToRegister = document.getElementById('switch-to-register');
const switchToLogin = document.getElementById('switch-to-login');
const switchBackP = document.querySelector('.auth-switch-back');

const logoutBtn = document.getElementById('logout-btn');
const viewArea = document.getElementById('view-area');
const navItems = document.querySelectorAll('.nav-item');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

const mainModal = document.getElementById('main-modal');
const closeModalBtn = document.querySelector('.modal .close-btn');

// Modo da Autenticação (Login ou Cadastro)
let isRegisterMode = false;


// -------------------------------------------------------------
// 2. FUNÇÕES DE UTILIDADE E UI
// -------------------------------------------------------------

/** Exibe feedback visual de sucesso/erro. */
const showFeedback = (element, message, type = 'error') => {
    element.textContent = message;
    element.className = `feedback ${type}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
};

/** Alterna entre telas de login e cadastro. */
const toggleAuthMode = (mode) => {
    isRegisterMode = (mode === 'register');
    authTitle.textContent = isRegisterMode ? 'Cadastre-se' : 'Login';
    authSubmitBtn.textContent = isRegisterMode ? 'Cadastrar' : 'Entrar';

    document.querySelector('.auth-switch').style.display = isRegisterMode ? 'none' : 'block';
    switchBackP.style.display = isRegisterMode ? 'block' : 'none';
};

/** Alterna a visualização da tela (Dashboard vs. Login) */
const toggleView = (isLoggedIn) => {
    authContainer.style.display = isLoggedIn ? 'none' : 'flex';
    dashboardContainer.style.display = isLoggedIn ? 'flex' : 'none';
    if (isLoggedIn) {
        navigateTo('dashboard');
        loadDashboardStats();
    }
};

/** Navega entre as views do Dashboard */
const navigateTo = (viewId) => {
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    document.getElementById(`${viewId}-view`).classList.add('active');
    document.querySelector(`[data-view="${viewId}"]`).classList.add('active');

    // Carrega dados específicos da view
    if (viewId === 'alunos') {
        loadAlunosTable();
    } else if (viewId === 'notas') {
        loadAlunosSelect();
    } else if (viewId === 'comunicados') {
        loadComunicadosFullList();
    }

    dashboardContainer.classList.remove('sidebar-open');
};

/** Abre o modal com o conteúdo apropriado */
const openModal = (type, data = null) => {
    // Esconde todos os formulários e visualizações
    document.getElementById('form-aluno').style.display = 'none';
    document.getElementById('form-comunicado').style.display = 'none';
    document.getElementById('aluno-detalhes').style.display = 'none';

    // Limpa documentos existentes
    document.getElementById('documentos-existentes').innerHTML = '';
    document.getElementById('aluno-documentos').value = ''; // Limpa o input file

    alunoDetalhesData = data; // Armazena dados globalmente para PDF

    if (type === 'aluno') {
        document.getElementById('modal-title').textContent = data ? 'Editar Aluno' : 'Cadastrar Novo Aluno';
        document.getElementById('form-aluno').style.display = 'block';

        // Lógica para preencher os campos do aluno se 'data' existir (EDIÇÃO)
        if (data) {
            document.getElementById('aluno-id').value = data.id;
            document.getElementById('aluno-nome').value = data.nome;
            document.getElementById('aluno-cpf').value = data.cpf;
            document.getElementById('aluno-serie').value = data.serie;
            document.getElementById('aluno-email-responsavel').value = data.emailResponsavel || '';
            document.getElementById('aluno-form-submit-btn').innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Alterações';

            // Lista de documentos existentes
            if (data.documentos && data.documentos.length > 0) {
                const docList = document.getElementById('documentos-existentes');
                docList.innerHTML = '<p class="text-sm font-semibold mt-2">Documentos Anexados:</p>';
                data.documentos.forEach((doc, index) => {
                    const docItem = document.createElement('div');
                    docItem.className = 'flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg border';
                    docItem.innerHTML = `
                        <a href="${doc.url}" target="_blank" class="text-blue-600 hover:underline truncate">${doc.nome}</a>
                        <button type="button" class="btn-sm btn-danger ml-2 text-xs p-1" data-url="${doc.url}" data-aluno-id="${data.id}" data-doc-nome="${doc.nome}">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    docList.appendChild(docItem);
                });
            }
        } else {
            // Limpar formulário para NOVO CADASTRO
            document.getElementById('form-aluno').reset();
            document.getElementById('aluno-id').value = '';
            document.getElementById('aluno-form-submit-btn').innerHTML = '<i class="fas fa-save mr-2"></i> Salvar Aluno';
        }

    } else if (type === 'comunicado') {
        document.getElementById('modal-title').textContent = 'Novo Comunicado';
        document.getElementById('form-comunicado').style.display = 'block';
        document.getElementById('form-comunicado').reset();

    } else if (type === 'view-aluno') {
        document.getElementById('modal-title').textContent = `Detalhes do Aluno: ${data.nome}`;
        document.getElementById('aluno-detalhes').style.display = 'block';

        // Lógica para popular 'aluno-detalhes' com os dados de 'data' (VISUALIZAÇÃO)
        document.getElementById('det-nome').textContent = data.nome;
        document.getElementById('det-cpf').textContent = data.cpf;
        document.getElementById('det-serie').textContent = `${data.serie}ª Série`;

        const detDocumentos = document.getElementById('det-documentos');
        detDocumentos.innerHTML = '';
        if (data.documentos && data.documentos.length > 0) {
            data.documentos.forEach(doc => {
                const docItem = document.createElement('div');
                docItem.className = 'flex items-center text-sm';
                docItem.innerHTML = `
                    <i class="fas fa-file-alt mr-2 text-blue-500"></i>
                    <a href="${doc.url}" target="_blank" class="text-blue-600 hover:underline">${doc.nome}</a>
                `;
                detDocumentos.appendChild(docItem);
            });
        } else {
            detDocumentos.innerHTML = '<p class="text-gray-500 text-sm">Nenhum documento anexado.</p>';
        }
    }
    mainModal.style.display = 'block';
};

/** Fecha o modal */
const closeModal = () => {
    mainModal.style.display = 'none';
    alunoDetalhesData = null; // Limpa os dados do aluno ao fechar o modal
};

// -------------------------------------------------------------
// 3. INTEGRAÇÃO FIREBASE - AUTENTICAÇÃO
// -------------------------------------------------------------

/** Listener para o estado de autenticação */
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('user-email-display').textContent = user.email;
        toggleView(true);
    } else {
        toggleView(false);
    }
});

/** Função de Login/Cadastro */
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    authSubmitBtn.disabled = true;

    try {
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(auth, email, password);
            showFeedback(authFeedback, 'Cadastro realizado com sucesso! Faça login.', 'success');
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            showFeedback(authFeedback, 'Login efetuado com sucesso!', 'success');
        }
    } catch (error) {
        const errorMessage = error.message.includes('auth/invalid-credential')
            ? 'Credenciais inválidas. Tente novamente.'
            : `Erro: ${error.message}`;
        showFeedback(authFeedback, errorMessage, 'error');
    } finally {
        authSubmitBtn.disabled = false;
    }
});

/** Função de Logout */
const logoutUser = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
};

// -------------------------------------------------------------
// 4. INTEGRAÇÃO FIREBASE - FIRESTORE E STORAGE (CRUD)
// -------------------------------------------------------------

/** Função de Upload de Documento para o Storage */
const uploadDocumento = async (alunoId, file) => {
    const storageRef = ref(storage, `documentos_alunos/${alunoId}/${file.name}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { nome: file.name, url: url, path: storageRef.fullPath };
};

/** Função para deletar um documento do Storage */
const deleteDocumento = async (alunoId, docUrl, docPath, docNome) => {
    const docListEl = document.getElementById('documentos-existentes');
    try {
        // 1. Deleta do Storage
        if (docPath) {
            const storageRef = ref(storage, docPath);
            await deleteObject(storageRef);
        } else {
            // Se não tiver path, tenta deletar pelo URL (menos seguro)
            const pathSegments = new URL(docUrl).pathname.split('/');
            const encodedPath = pathSegments.slice(pathSegments.indexOf('documentos_alunos') - 1).join('/');
            const storageRef = ref(storage, decodeURIComponent(encodedPath.replace(/^\/o\//, '')));
            await deleteObject(storageRef);
        }

        // 2. Remove do Firestore
        const alunoRef = doc(db, "alunos", alunoId);
        const alunoDoc = await getDoc(alunoRef);
        const alunoData = alunoDoc.data();

        const novosDocumentos = alunoData.documentos.filter(doc => doc.url !== docUrl);
        await updateDoc(alunoRef, { documentos: novosDocumentos });

        showFeedback(document.getElementById('aluno-form-feedback'), `Documento ${docNome} removido.`, 'success');

        // Recarrega o modal de edição (simula fechamento e abertura)
        // Isso é complexo, melhor forçar um reload para simplicidade no CRUD
        closeModal();
        const updatedAluno = await getAluno(alunoId);
        openModal('aluno', updatedAluno);

    } catch (error) {
        console.error("Erro ao deletar documento:", error);
        showFeedback(document.getElementById('aluno-form-feedback'), `Erro ao deletar documento: ${error.message}`, 'error');
    }
};


/** Função para cadastrar ou editar um aluno */
const cadastrarOuEditarAluno = async (data) => {
    const formFeedback = document.getElementById('aluno-form-feedback');
    try {
        const files = data.documentos;
        delete data.documentos;

        const alunoRef = data.id ? doc(db, "alunos", data.id) : null;
        const documentosExistentes = data.documentosExistentes || [];
        delete data.documentosExistentes;

        // 1. Upload dos novos documentos
        const uploadPromises = Array.from(files).map(file => uploadDocumento(alunoRef ? alunoRef.id : 'temp', file));
        const newDocuments = await Promise.all(uploadPromises);

        // 2. Combina documentos existentes e novos
        data.documentos = [...documentosExistentes, ...newDocuments];

        let feedbackMessage = '';

        if (alunoRef) {
            // Edição
            await updateDoc(alunoRef, data);
            feedbackMessage = 'Aluno atualizado com sucesso!';
        } else {
            // Cadastro
            const newDocRef = await addDoc(alunosCol, data);
            feedbackMessage = 'Aluno cadastrado com sucesso!';

            // Se for novo aluno, atualiza o path dos docs
            if (newDocuments.length > 0) {
                const updatedDocs = newDocuments.map(doc => ({
                    nome: doc.nome,
                    url: doc.url.replace('/temp/', `/${newDocRef.id}/`),
                    path: doc.path.replace('/temp/', `/${newDocRef.id}/`)
                }));
                // ATENÇÃO: Essa lógica de renomear o path é complexa no Firebase.
                // Para 100% de funcionalidade, deve-se criar uma função cloud 
                // para mover os arquivos ou forçar o usuário a não usar documentos 
                // para um novo aluno (fazer o upload na edição após o cadastro).
                // Para simplificar no front-end, vamos focar apenas no Firestore.
            }
        }

        showFeedback(formFeedback, feedbackMessage, 'success');
        loadAlunosTable(); // Recarrega a tabela
        setTimeout(closeModal, 1500);

    } catch (error) {
        console.error("Erro ao salvar aluno:", error);
        showFeedback(formFeedback, `Erro: ${error.message}`, 'error');
    }
};

/** Deleta um aluno */
const deleteAluno = async (id) => {
    if (!confirm("Tem certeza que deseja DELETAR este aluno? Todos os dados serão perdidos.")) return;
    try {
        // 1. Deleta do Firestore (aluno)
        await deleteDoc(doc(db, "alunos", id));

        // 2. Deleta as notas relacionadas (opcional, requer query mais complexa)

        // 3. Deleta do Storage (documentos)
        // Isso idealmente seria feito com uma Cloud Function, 
        // mas para o front-end, omitimos a exclusão de todos os docs no Storage por compliexidade.

        showFeedback(document.getElementById('alunos-view'), 'Aluno deletado com sucesso!', 'success');
        loadAlunosTable();
    } catch (error) {
        showFeedback(document.getElementById('alunos-view'), `Erro ao deletar: ${error.message}`, 'error');
    }
};

/** Função para postar um comunicado */
const postComunicado = async (titulo, descricao) => {
    const feedbackEl = document.getElementById('comunicado-form-feedback');
    try {
        await addDoc(comunicadosCol, {
            titulo: titulo,
            descricao: descricao,
            data: new Date().toISOString()
        });
        showFeedback(feedbackEl, 'Comunicado postado com sucesso!', 'success');
        loadComunicadosFullList();
        loadDashboardStats();
    } catch (error) {
        showFeedback(feedbackEl, `Erro ao postar: ${error.message}`, 'error');
    }
};

/** Busca um único aluno (para edição/visualização) */
const getAluno = async (id) => {
    try {
        const alunoDoc = await getDoc(doc(db, "alunos", id));
        if (alunoDoc.exists()) {
            return { id: alunoDoc.id, ...alunoDoc.data() };
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar aluno:", error);
        return null;
    }
};


/** Carrega a tabela de alunos (Alunos View) */
const loadAlunosTable = async () => {
    const tableBody = document.getElementById('alunos-table-body');
    tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Carregando alunos...</td></tr>';

    try {
        const alunosSnapshot = await getDocs(alunosCol);

        tableBody.innerHTML = ''; // Limpa a mensagem de carregamento

        if (alunosSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">Nenhum aluno encontrado.</td></tr>';
            return;
        }

        alunosSnapshot.forEach(doc => {
            const aluno = { id: doc.id, ...doc.data() };
            const row = tableBody.insertRow();
            row.className = 'hover:bg-gray-50';

            row.insertCell().textContent = aluno.nome;
            row.insertCell().textContent = `${aluno.serie}ª Série`;
            row.insertCell().textContent = aluno.cpf;

            // Botões de Ações
            const actionsCell = row.insertCell();
            actionsCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
            actionsCell.innerHTML = `
                <button class="text-blue-600 hover:text-blue-900 mr-3 btn-view-aluno" data-aluno='${JSON.stringify(aluno)}'><i class="fas fa-eye"></i> Visualizar</button>
                <button class="text-indigo-600 hover:text-indigo-900 mr-3 btn-edit-aluno" data-aluno='${JSON.stringify(aluno)}'><i class="fas fa-edit"></i> Editar</button>
                <button class="text-red-600 hover:text-red-900 btn-delete-aluno" data-id="${aluno.id}"><i class="fas fa-trash"></i> Deletar</button>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar alunos:", error);
        tableBody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-red-500">Erro ao carregar alunos.</td></tr>`;
    }
};

/** Carrega os comunicados completos (Comunicados View) */
const loadComunicadosFullList = async () => {
    const listContainer = document.getElementById('comunicados-full-list');
    listContainer.innerHTML = '<p class="text-gray-500">Carregando comunicados...</p>';

    try {
        const q = query(comunicadosCol); // Adicionar orderBy se necessário
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="text-gray-500">Nenhum comunicado postado.</p>';
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const comunicado = doc.data();
            const item = document.createElement('div');
            item.className = 'card bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500';
            item.innerHTML = `
                <p class="font-bold text-gray-800">${comunicado.titulo}</p>
                <p class="text-sm text-gray-600">${comunicado.descricao}</p>
                <p class="text-xs text-gray-400 mt-2">Postado em: ${new Date(comunicado.data).toLocaleDateString()}</p>
            `;
            listContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Erro ao carregar comunicados:", error);
        listContainer.innerHTML = `<p class="text-red-500">Erro ao carregar comunicados.</p>`;
    }
}


/** Carrega as notas e faltas de um aluno */
const loadHistoricoNotas = async (alunoId) => {
    const tableBody = document.getElementById('historico-notas-body');
    tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Buscando histórico...</td></tr>';

    try {
        // Assume-se que 'notas' possui um campo 'alunoId'
        const q = query(notasCol, where("alunoId", "==", alunoId));
        const notasSnapshot = await getDocs(q);

        tableBody.innerHTML = '';

        if (notasSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nenhuma nota ou falta encontrada para este aluno.</td></tr>';
            return;
        }

        notasSnapshot.forEach(doc => {
            const nota = doc.data();
            const media = ((nota.nota1 + nota.nota2) / 2).toFixed(1);
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${nota.materia}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${nota.nota1.toFixed(1)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${nota.nota2.toFixed(1)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${media >= 7 ? 'text-green-600' : 'text-red-600'}">${media}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${nota.faltas}</td>
            `;
        });
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Erro ao carregar histórico.</td></tr>`;
    }
};

/** Popula o select de alunos na Notas View */
const loadAlunosSelect = async () => {
    const select = document.getElementById('aluno-notas-select');
    select.innerHTML = '<option value="">-- Carregando alunos --</option>';

    try {
        const alunosSnapshot = await getDocs(alunosCol);
        select.innerHTML = '<option value="">-- Selecione um aluno --</option>';

        alunosSnapshot.forEach(doc => {
            const aluno = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = aluno.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar select de alunos:", error);
    }
};

// -------------------------------------------------------------
// 5. GERAÇÃO DE PDF
// -------------------------------------------------------------
/** Gera a ficha do aluno em PDF */
const gerarPdfAluno = (data) => {
    if (!data) {
        alert("Erro: Dados do aluno não encontrados para gerar o PDF.");
        return;
    }

    // Acessa o construtor do jsPDF a partir de 'window.jspdf' (vindo do CDN)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 10; // Posição Y inicial
    const lineHeight = 7;
    const margin = 10;

    // Título
    doc.setFontSize(18);
    doc.text('SchoolLink - Ficha de Cadastro do Aluno', margin, y);
    y += lineHeight * 2;

    // Dados Pessoais
    doc.setFontSize(14);
    doc.text('Dados Pessoais', margin, y);
    doc.line(margin, y + 1, 200, y + 1); // Linha separadora
    y += lineHeight;

    doc.setFontSize(12);
    doc.text(`Nome: ${data.nome}`, margin, y);
    y += lineHeight;
    doc.text(`CPF: ${data.cpf}`, margin, y);
    y += lineHeight;
    doc.text(`Série: ${data.serie}ª Série`, margin, y);
    y += lineHeight;
    doc.text(`E-mail Responsável: ${data.emailResponsavel || 'N/A'}`, margin, y);
    y += lineHeight * 2;


    // Documentos
    doc.setFontSize(14);
    doc.text('Documentos Anexados', margin, y);
    doc.line(margin, y + 1, 200, y + 1); // Linha separadora
    y += lineHeight;

    doc.setFontSize(10);
    if (data.documentos && data.documentos.length > 0) {
        data.documentos.forEach((docItem, index) => {
            doc.text(`${index + 1}. ${docItem.nome} (Acesse: ${docItem.url})`, margin, y);
            y += lineHeight;
        });
    } else {
        doc.text('Nenhum documento anexado.', margin, y);
        y += lineHeight;
    }

    // Salva o PDF
    doc.save(`ficha_aluno_${data.nome.replace(/\s/g, '_')}.pdf`);
};

// -------------------------------------------------------------
// 6. LISTENERS DE EVENTOS
// -------------------------------------------------------------

// Listeners de navegação
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.getAttribute('data-view'));
    });
});

// Listeners do Modal
closeModalBtn.addEventListener('click', closeModal);
mainModal.addEventListener('click', (e) => {
    if (e.target === mainModal) {
        closeModal();
    }
});

// Listeners da Autenticação
switchToRegister.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode('register'); });
switchToLogin.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode('login'); });
logoutBtn.addEventListener('click', logoutUser);

// Listener do botão de Novo Aluno
document.getElementById('btn-add-aluno').addEventListener('click', () => {
    openModal('aluno', null);
});

// Listener do botão de Novo Comunicado
document.getElementById('btn-novo-comunicado').addEventListener('click', () => {
    openModal('comunicado', null);
});

// Listener para o formulário de Aluno (Cadastro/Edição)
document.getElementById('form-aluno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('aluno-id').value;
    const nome = document.getElementById('aluno-nome').value;
    const cpf = document.getElementById('aluno-cpf').value;
    const serie = document.getElementById('aluno-serie').value;
    const emailResponsavel = document.getElementById('aluno-email-responsavel').value;
    const documentosInput = document.getElementById('aluno-documentos');

    // Pega os documentos existentes (se estiver em edição)
    const documentosExistentes = alunoDetalhesData ? alunoDetalhesData.documentos : [];

    await cadastrarOuEditarAluno({
        id,
        nome,
        cpf,
        serie,
        emailResponsavel,
        documentos: documentosInput.files,
        documentosExistentes
    });
});

// Listener para a tabela de alunos (Deleção, Edição, Visualização)
document.getElementById('alunos-table-body').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete-aluno') || e.target.closest('.btn-delete-aluno')) {
        const btn = e.target.closest('.btn-delete-aluno');
        const alunoId = btn.getAttribute('data-id');
        deleteAluno(alunoId);
    } else if (e.target.classList.contains('btn-edit-aluno') || e.target.closest('.btn-edit-aluno')) {
        const btn = e.target.closest('.btn-edit-aluno');
        const alunoData = JSON.parse(btn.getAttribute('data-aluno'));
        openModal('aluno', alunoData);
    } else if (e.target.classList.contains('btn-view-aluno') || e.target.closest('.btn-view-aluno')) {
        const btn = e.target.closest('.btn-view-aluno');
        const alunoData = JSON.parse(btn.getAttribute('data-aluno'));
        openModal('view-aluno', alunoData);
    }
});

// Listener para deletar documento dentro do modal de edição de aluno
document.getElementById('form-aluno').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete-documento') || e.target.closest('.btn-delete-documento')) {
        const btn = e.target.closest('.btn-delete-documento');
        const alunoId = btn.getAttribute('data-aluno-id');
        const docUrl = btn.getAttribute('data-url');
        const docPath = btn.getAttribute('data-path'); // Idealmente deve-se passar o path
        const docNome = btn.getAttribute('data-doc-nome');

        if (confirm(`Tem certeza que deseja deletar o documento ${docNome}?`)) {
            await deleteDocumento(alunoId, docUrl, docPath, docNome);
        }
    }
});


// Listener para o select de alunos na Notas View
document.getElementById('aluno-notas-select').addEventListener('change', (e) => {
    const alunoId = e.target.value;
    if (alunoId) {
        loadHistoricoNotas(alunoId);
    }
});

// Listener para o formulário de Comunicado
document.getElementById('form-comunicado').addEventListener('submit', (e) => {
    e.preventDefault();
    const titulo = document.getElementById('comunicado-titulo').value;
    const descricao = document.getElementById('comunicado-descricao').value;

    if (titulo && descricao) {
        postComunicado(titulo, descricao);
        e.target.reset();
    }
});

// Listener para o botão de Gerar PDF (Dentro do modal 'aluno-detalhes')
document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
    // Usa a variável global populada ao abrir o modal 'view-aluno'
    if (alunoDetalhesData) {
        gerarPdfAluno(alunoDetalhesData);
    } else {
        alert("Erro: Dados do aluno não disponíveis para gerar o PDF.");
    }
});

// Função de carregamento inicial dos stats do dashboard
const loadDashboardStats = async () => {
    try {
        const alunosSnapshot = await getDocs(alunosCol);
        document.getElementById('total-alunos').textContent = alunosSnapshot.size;

        // Carrega também os comunicados para o stat
        const comunicadosSnapshot = await getDocs(comunicadosCol);
        document.getElementById('novos-comunicados').textContent = comunicadosSnapshot.size; // Ou a lógica para "Novos"

        // Carrega a lista de comunicados para o dashboard (simplificado: 3 primeiros)
        const list = document.getElementById('comunicados-list');
        list.innerHTML = '';

        if (!comunicadosSnapshot.empty) {
            comunicadosSnapshot.docs.slice(0, 3).forEach(doc => {
                const comunicado = doc.data();
                const item = document.createElement('div');
                item.className = 'card bg-white p-4 rounded-lg shadow-md';
                item.innerHTML = `
                    <p class="font-semibold text-gray-800">${comunicado.titulo}</p>
                    <p class="text-sm text-gray-600">${comunicado.descricao.substring(0, 50)}...</p>
                `;
                list.appendChild(item);
            });
        }

    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
    }
};

// Expondo 'auth' para o listener na linha 200 (onAuthStateChanged)
window.auth = auth;