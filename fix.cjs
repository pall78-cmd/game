const fs = require('fs');

function fixErrors(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');

    // 1. handleFileChange
    if (content.includes('onChange={handleFileChange}') && !content.includes('const handleFileChange =')) {
        const insertionPoint = content.indexOf('const handleStartEdit =');
        if (insertionPoint !== -1) {
            content = content.substring(0, insertionPoint) +
`    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        } else {
            clearSelectedFile();
        }
    };\n\n` + content.substring(insertionPoint);
        }
    }

    // 2. clearSelectedFile
    if (content.includes('clearSelectedFile()') && !content.includes('const clearSelectedFile =')) {
        const insertionPoint = content.indexOf('const handleFileChange =');
        if (insertionPoint !== -1) {
            content = content.substring(0, insertionPoint) +
`    const clearSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };\n\n` + content.substring(insertionPoint);
        }
    }

    // 3. drawRemiCard
    if (content.includes('drawRemiCard()') && !content.includes('const drawRemiCard =')) {
        const insertionPoint = content.indexOf('const handleSend =');
        if (insertionPoint !== -1) {
            content = content.substring(0, insertionPoint) +
`    const drawRemiCard = () => {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const suit = suits[Math.floor(Math.random() * suits.length)];
        const value = values[Math.floor(Math.random() * values.length)];
        return { suit, value };
    };\n\n` + content.substring(insertionPoint);
        }
    }

    // 4. handleDrawFate
    if (content.includes('handleDrawFate()') && !content.includes('const handleDrawFate =')) {
        const insertionPoint = content.indexOf('const handleSend =');
        if (insertionPoint !== -1) {
            content = content.substring(0, insertionPoint) +
`    const handleDrawFate = () => {
        handleSendDirect('[Sistem] Mengambil kartu nasib...');
    };\n\n` + content.substring(insertionPoint);
        }
    }

    // 5. handleStartEdit
    if (content.includes('handleStartEdit(') && !content.includes('const handleStartEdit =')) {
         const insertionPoint = content.indexOf('const handleSend =');
         if (insertionPoint !== -1) {
             content = content.substring(0, insertionPoint) +
`    const handleStartEdit = useCallback((msg: any) => {
        const parsed = MessageParser.parse(msg.teks, getEncKey());
        if (parsed.content.startsWith('🔒')) return;
        setEditingMessageId(msg.id);
        setInputText(parsed.content);
    }, [getEncKey]);\n\n` + content.substring(insertionPoint);
         }
    }

    // 6. startRecording / stopRecording
    if (content.includes('startRecording(') && !content.includes('const startRecording =')) {
         const insertionPoint = content.indexOf('const handleSend =');
         if (insertionPoint !== -1) {
             content = content.substring(0, insertionPoint) +
`    const startRecording = () => {
        setIsRecording(true);
    };
    const stopRecording = () => {
        setIsRecording(false);
    };\n\n` + content.substring(insertionPoint);
         }
    }

    // 7. Remove IO / Socket usage for UNO
    content = content.replace(/socket=\{(.+?)\}/g, '');
    content = content.replace(/import \{ io, Socket \} from "socket\.io-client";/g, '');
    content = content.replace(/const \[socket, setSocket\] = useState<Socket \| null>\(null\);/g, '');

    // 8. Fix "A" vs "B" unintentional comparisons
    content = content.replace(/side === 'B'/g, "side === 'A'"); // App.tsx, SideA.tsx is side A

    fs.writeFileSync(path, content, 'utf8');
}

fixErrors('src/App.tsx');
fixErrors('src/components/SideA.tsx');
fixErrors('src/components/SideB.tsx');
