const COMMANDS = {};

// قائمة الأوامر الأساسية
COMMANDS.help = {
  description: "عرض جميع الأوامر المتاحة",
  action: async () => {
    return Object.keys(COMMANDS)
      .map(cmd => `• ${cmd} - ${COMMANDS[cmd].description}`)
      .join("\n");
  }
};

COMMANDS.exit = {
  description: "العودة إلى user",
  action: async ({ switchRole }) => {
    switchRole('user');
    return "🔒 Returned to user privileges.";
  }
};

COMMANDS.sudo = {
  description: "رفع الصلاحية إلى admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'su') await switchRole('admin');
    else return "Usage: sudo su";
  }
};

COMMANDS.su = {
  description: "رفع الصلاحية إلى root",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'root') await switchRole('root');
    else return "Usage: su root";
  }
};

COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => {
    return args.join(" ");
  }
};
