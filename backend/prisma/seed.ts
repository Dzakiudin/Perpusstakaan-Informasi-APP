import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database with extensive data...');

    // Clear existing data (optional, careful in production)
    console.log('🧹 Clearing existing data...');
    await prisma.loan.deleteMany({});
    await prisma.book.deleteMany({});
    await prisma.member.deleteMany({});
    await prisma.class.deleteMany({});
    await prisma.user.deleteMany({});

    // Create users
    console.log('👥 Creating users...');
    const users = [
        {
            name: 'Administrator',
            email: 'admin@perpus.com',
            password: await bcrypt.hash('admin123', 10),
            role: 'admin',
        },
        {
            name: 'Pustakawan Utama',
            email: 'pustakawan@perpus.com',
            password: await bcrypt.hash('pustakawan123', 10),
            role: 'pustakawan',
        },
        {
            name: 'Budi Santoso',
            email: 'budi@perpus.com',
            password: await bcrypt.hash('pustakawan123', 10),
            role: 'pustakawan',
        },
        {
            name: 'Siti Rahayu',
            email: 'siti@perpus.com',
            password: await bcrypt.hash('pustakawan123', 10),
            role: 'pustakawan',
        },
    ];

    const createdUsers = await Promise.all(
        users.map(user =>
            prisma.user.create({
                data: user,
            })
        )
    );

    // Create classes (20 classes)
    console.log('🏫 Creating classes...');
    const kelasList = [
        'X IPA 1', 'X IPA 2', 'X IPA 3', 'X IPA 4',
        'X IPS 1', 'X IPS 2', 'X IPS 3',
        'XI IPA 1', 'XI IPA 2', 'XI IPA 3', 'XI IPA 4',
        'XI IPS 1', 'XI IPS 2', 'XI IPS 3',
        'XII IPA 1', 'XII IPA 2', 'XII IPA 3', 'XII IPA 4',
        'XII IPS 1', 'XII IPS 2', 'XII IPS 3',
        'X Bahasa', 'XI Bahasa', 'XII Bahasa'
    ];

    const waliKelasList = [
        'Budi Santoso', 'Siti Rahayu', 'Ahmad Wijaya', 'Dewi Lestari',
        'Rina Fitriani', 'Joko Prasetyo', 'Maya Sari', 'Rudi Hartono',
        'Linda Wati', 'Agus Supriyadi', 'Nina Novita', 'Hendra Kurniawan',
        'Dian Puspita', 'Eko Budiman', 'Fitri Handayani', 'Gunawan Setiawan',
        'Hana Melati', 'Irfan Maulana', 'Juli Astuti', 'Kartika Dewi',
        'Lukman Hakim', 'Mega Wulandari', 'Nanda Pratama', 'Oki Setiawan'
    ];

    const classes = await Promise.all(
        kelasList.map((name, index) =>
            prisma.class.create({
                data: {
                    name,
                    waliKelas: waliKelasList[index % waliKelasList.length],
                },
            })
        )
    );

    // Create members (100 students)
    console.log('👨‍🎓 Creating members...');
    const members = [];

    for (let i = 1; i <= 100; i++) {
        const nis = `2023${String(i).padStart(4, '0')}`;
        const classIndex = Math.floor(Math.random() * classes.length);
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        members.push(
            prisma.member.create({
                data: {
                    nis,
                    name: `${firstName} ${lastName}`,
                    class: {
                        connect: { id: classes[classIndex].id }
                    },
                    phone: `08${faker.string.numeric(10)}`,
                    status: Math.random() > 0.1 ? 'active' : 'inactive',
                },
            })
        );
    }

    const createdMembers = await Promise.all(members);

    // Create books (50 books)
    console.log('📚 Creating books...');
    const bookCategories = [
        'Novel', 'Pelajaran', 'Biografi', 'Sains', 'Teknologi',
        'Sejarah', 'Filsafat', 'Agama', 'Bahasa', 'Seni',
        'Olahraga', 'Kesehatan', 'Ekonomi', 'Hukum', 'Psikologi'
    ];

    const publishers = [
        'Erlangga', 'Gramedia', 'Kemendikbud', 'Yudhistira',
        'Tiga Serangkai', 'Balai Pustaka', 'Mizan', 'Bentang Pustaka',
        'Andi Offset', 'Grasindo', 'Elex Media', 'Bumi Aksara'
    ];

    const books = [];

    for (let i = 1; i <= 50; i++) {
        const isbn = `978-602-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${Math.floor(Math.random() * 10)}`;
        const barcode = `BK${String(i).padStart(3, '0')}`;
        const category = bookCategories[Math.floor(Math.random() * bookCategories.length)];
        const totalCopies = Math.floor(Math.random() * 10) + 1;
        const availableCopies = Math.floor(Math.random() * totalCopies);

        books.push(
            prisma.book.create({
                data: {
                    isbn,
                    barcode,
                    title: faker.lorem.words({ min: 2, max: 5 }),
                    author: faker.person.fullName(),
                    publisher: publishers[Math.floor(Math.random() * publishers.length)],
                    category,
                    rackLocation: `${String.fromCharCode(65 + Math.floor(Math.random() * 5))}${Math.floor(Math.random() * 20) + 1}`,
                    totalCopies,
                    availableCopies,
                },
            })
        );
    }

    const createdBooks = await Promise.all(books);

    // Create specific popular books
    console.log('📖 Creating popular books...');
    const popularBooks = [
        {
            isbn: '978-602-03-1234-5',
            barcode: 'POP001',
            title: 'Laskar Pelangi',
            author: 'Andrea Hirata',
            publisher: 'Bentang Pustaka',
            category: 'Novel',
            rackLocation: 'A1',
            totalCopies: 10,
            availableCopies: 3,
        },
        {
            isbn: '978-602-03-1234-6',
            barcode: 'POP002',
            title: 'Bumi Manusia',
            author: 'Pramoedya Ananta Toer',
            publisher: 'Hasta Mitra',
            category: 'Novel',
            rackLocation: 'A2',
            totalCopies: 5,
            availableCopies: 1,
        },
        {
            isbn: '978-602-8519-93-9',
            barcode: 'POP003',
            title: 'Fisika untuk SMA Kelas X',
            author: 'Marthen Kanginan',
            publisher: 'Erlangga',
            category: 'Pelajaran',
            rackLocation: 'B1',
            totalCopies: 15,
            availableCopies: 8,
        },
        {
            isbn: '978-602-298-123-4',
            barcode: 'POP004',
            title: 'Matematika Wajib SMA Kelas XI',
            author: 'Sudianto S, dkk',
            publisher: 'Yudhistira',
            category: 'Pelajaran',
            rackLocation: 'B2',
            totalCopies: 12,
            availableCopies: 5,
        },
        {
            isbn: '978-979-22-3845-9',
            barcode: 'POP005',
            title: 'Pulang',
            author: 'Tere Liye',
            publisher: 'Gramedia',
            category: 'Novel',
            rackLocation: 'A3',
            totalCopies: 8,
            availableCopies: 2,
        },
    ];

    await Promise.all(
        popularBooks.map(book =>
            prisma.book.upsert({
                where: { isbn: book.isbn },
                update: {},
                create: book,
            })
        )
    );

    // Create loans (transactions)
    console.log('📝 Creating loan transactions...');
    const loans = [];

    // Create 30 loan records
    for (let i = 0; i < 30; i++) {
        const member = createdMembers[Math.floor(Math.random() * createdMembers.length)];
        const book = createdBooks[Math.floor(Math.random() * createdBooks.length)];
        const loanDate = faker.date.past({ years: 1 });
        const dueDate = new Date(loanDate);
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks loan period

        let returnDate = null;
        let status = 'borrowed';
        let fine = 0;

        // 80% chance the book is returned
        if (Math.random() > 0.2) {
            returnDate = new Date(loanDate);
            returnDate.setDate(returnDate.getDate() + Math.floor(Math.random() * 21));
            status = 'returned';

            // Calculate fine if returned late
            if (returnDate > dueDate) {
                const daysLate = Math.ceil((returnDate.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
                fine = daysLate * 1000; // Rp 1000 per day
            }
        }

        // 10% chance of being overdue
        else if (Math.random() > 0.9) {
            status = 'overdue';
        }

        loans.push(
            prisma.loan.create({
                data: {
                    memberId: member.id,
                    loanDate,
                    dueDate,
                    returnDate,
                    status,
                    finedAmount: fine,
                    createdById: createdUsers[1].id, // Pustakawan utama
                    items: {
                        create: [
                            {
                                bookId: book.id,
                                bookTitle: book.title,
                                bookBarcode: book.barcode,
                                status: status === 'returned' ? 'returned' : 'borrowed',
                                returnedAt: returnDate,
                            }
                        ]
                    }
                },
            })
        );
    }

    // Update book available copies based on loans
    console.log('🔄 Updating book availability...');
    const allBorrowedItems = await prisma.loanItem.findMany({
        where: { status: 'borrowed' },
        select: { bookId: true },
    });

    const borrowedCounts = allBorrowedItems.reduce((acc, item) => {
        if (item.bookId) {
            acc[item.bookId] = (acc[item.bookId] || 0) + 1;
        }
        return acc;
    }, {} as Record<number, number>);

    for (const [bookIdStr, borrowedCount] of Object.entries(borrowedCounts)) {
        const bookId = parseInt(bookIdStr);
        const book = await prisma.book.findUnique({
            where: { id: bookId },
        });

        if (book) {
            await prisma.book.update({
                where: { id: bookId },
                data: {
                    availableCopies: Math.max(0, book.totalCopies - borrowedCount),
                },
            });
        }
    }

    console.log('✅ Seeding completed successfully!');
    console.log('\n📊 Statistics:');
    console.log(`   - Users: ${createdUsers.length}`);
    console.log(`   - Classes: ${classes.length}`);
    console.log(`   - Members: ${createdMembers.length}`);
    console.log(`   - Books: ${createdBooks.length + popularBooks.length}`);
    console.log(`   - Loans: ${loans.length}`);

    console.log('\n🔑 Login credentials:');
    console.log('   Admin: admin@perpus.com / admin123');
    console.log('   Pustakawan: pustakawan@perpus.com / pustakawan123');

    console.log('\n📚 Popular books available:');
    popularBooks.forEach(book => {
        console.log(`   - ${book.title} by ${book.author} (Available: ${book.availableCopies}/${book.totalCopies})`);
    });

    console.log('\n🎯 Sample student credentials:');
    console.log('   NIS: 20230001 (first student)');
    console.log('   Check the database for more student NIS numbers');
}

main()
    .catch((e) => {
        console.error('❌ Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });