const { PrismaClient } = require('./src/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    // Ver tipos de usuario
    const userTypes = await prisma.userType.findMany();
    console.log('\n=== UserTypes ===');
    console.log(JSON.stringify(userTypes, null, 2));
    
    // Ver usuarios con sus tipos
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        userId: true,
        name: true,
        email: true,
        userUserTypes: {
          select: {
            userType: {
              select: { name: true }
            }
          }
        }
      }
    });
    
    console.log('\n=== Usuarios con sus tipos ===');
    users.forEach(u => {
      const types = u.userUserTypes.map(ut => ut.userType.name).join(', ');
      console.log(`- ${u.name} (${u.email}): [${types}]`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
