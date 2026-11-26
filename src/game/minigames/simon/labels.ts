// Words and questions of the pinhole camera quiz (scene universita, minigame id `simon`, Italian). The instruction card, the title and the
// result texts come from dialogue.it.json. Each question lists its right answer FIRST: the scene shuffles the rows when it draws them.
export const LABELS = {
    question: 'Domanda',
    keys: 'Su/Giù scegli, X conferma',
    notes: 'Appunti stropicciati',
    right: 'Giusto!',
    wrong: 'Sbagliato!'
};

export interface Question {
    ask: string;
    /** answers[0] is the right one */
    answers: [string, string, string, string];
    /** shown after the answer, two lines at most */
    why: string;
}

export const QUESTIONS: Question[] = [
    {
        ask: 'Una pinhole camera (foro stenopeico) forma\nl\'immagine con...',
        answers: ['Un piccolo foro e nessuna lente', 'Una lente molto grande', 'Uno specchio curvo', 'Un prisma di vetro'],
        why: 'Il foro lascia passare pochissimi raggi per ogni punto della scena: senza lenti l\'immagine si forma lo stesso.'
    },
    {
        ask: 'Com\'è l\'immagine sul fondo della scatola?',
        answers: ['Capovolta: sopra e sotto invertiti', 'Dritta, ma più piccola', 'Solo specchiata a destra e sinistra', 'Dritta, ma sempre sfocata'],
        why: 'I raggi si incrociano nel foro: in alto va in basso e a destra va a sinistra, l\'immagine è capovolta.'
    },
    {
        ask: 'Rimpicciolisci il foro. Cosa succede\nall\'immagine?',
        answers: ['Più nitida ma più scura: posa più lunga', 'Più nitida e più luminosa', 'Più sfocata ma più luminosa', 'Resta uguale, cambia solo il colore'],
        why: 'Un foro piccolo dà più nitidezza ma meno luce: serve un tempo di posa più lungo.'
    }
];
