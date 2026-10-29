// Kremen Learn per-user offline installer. Linux only; no elevated privileges.
#include <algorithm>
#include <array>
#include <cerrno>
#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <dlfcn.h>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/stat.h>
#include <sys/utsname.h>
#include <unistd.h>
#include <vector>

#ifndef KREMEN_PAYLOAD_SIZE
#define KREMEN_PAYLOAD_SIZE 0
#endif
#ifndef KREMEN_PAYLOAD_SHA256
#define KREMEN_PAYLOAD_SHA256 "unbundled"
#endif
#ifndef KREMEN_VERSION
#define KREMEN_VERSION "0.1.0"
#endif

namespace fs = std::filesystem;
namespace {
constexpr std::uint64_t maxPayload = 2ULL * 1024 * 1024 * 1024;
constexpr const char *ownership = "Kremen Learn installer v1\n";

// SHA-256 is implemented here so verification has no crypto package dependency.
class Sha256 {
    std::array<std::uint32_t, 8> state{0x6a09e667, 0xbb67ae85, 0x3c6ef372,
        0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19};
    std::array<unsigned char, 64> block{};
    std::uint64_t length = 0;
    std::size_t used = 0;
    static std::uint32_t rotr(std::uint32_t x, unsigned n) { return (x >> n) | (x << (32 - n)); }
    void transform() {
        static constexpr std::uint32_t k[] = {
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
        std::array<std::uint32_t, 64> w{};
        for (std::size_t i = 0; i < 16; ++i)
            for (int j = 0; j < 4; ++j) w[i] = (w[i] << 8) | block[i * 4 + j];
        for (int i = 16; i < 64; ++i) {
            auto a = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >> 3);
            auto b = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >> 10);
            w[i] = w[i-16] + a + w[i-7] + b;
        }
        auto a=state[0], b=state[1], c=state[2], d=state[3], e=state[4], f=state[5], g=state[6], h=state[7];
        for (int i=0; i<64; ++i) {
            auto t1 = h + (rotr(e,6)^rotr(e,11)^rotr(e,25)) + ((e&f)^((~e)&g)) + k[i] + w[i];
            auto t2 = (rotr(a,2)^rotr(a,13)^rotr(a,22)) + ((a&b)^(a&c)^(b&c));
            h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
        }
        state[0]+=a; state[1]+=b; state[2]+=c; state[3]+=d;
        state[4]+=e; state[5]+=f; state[6]+=g; state[7]+=h;
    }
public:
    void update(const char *data, std::size_t size) {
        length += size;
        for (std::size_t i=0; i<size; ++i) {
            block[used++] = static_cast<unsigned char>(data[i]);
            if (used==64) { transform(); used=0; }
        }
    }
    std::string finish() {
        auto bits=length*8;
        block[used++]=0x80;
        if (used>56) { while(used<64) block[used++]=0; transform(); used=0; }
        while(used<56) block[used++]=0;
        for(int i=7;i>=0;--i) block[used++]=static_cast<unsigned char>(bits>>(i*8));
        transform();
        std::ostringstream out;
        for(auto x:state) out<<std::hex<<std::setfill('0')<<std::setw(8)<<x;
        return out.str();
    }
};

std::string readText(const fs::path &path) {
    std::ifstream input(path);
    return std::string(std::istreambuf_iterator<char>(input), {});
}

void writeText(const fs::path &path, const std::string &text) {
    std::ofstream output(path, std::ios::trunc);
    output.exceptions(std::ios::failbit | std::ios::badbit);
    output << text;
}

std::string field(const char *data, std::size_t n) {
    return std::string(data, strnlen(data, n));
}

std::uint64_t octal(const char *data, std::size_t n) {
    std::uint64_t value=0;
    bool ended=false;
    for(std::size_t i=0;i<n;++i) {
        auto c=data[i];
        if(c=='\0'||c==' ') { if(value) ended=true; continue; }
        if(c<'0'||c>'7'||ended||value>(maxPayload>>3)) throw std::runtime_error("Invalid archive number");
        value=(value<<3)+(c-'0');
    }
    return value;
}

fs::path safeRelative(std::string name) {
    while(name.rfind("./",0)==0) name.erase(0,2);
    if(name.empty()||name==".") return {};
    if(name.size()>4096 || name.front()=='/' || name.find('\\')!=std::string::npos)
        throw std::runtime_error("Archive contains an unsafe path");
    for(unsigned char c:name) if(c<32||c==127) throw std::runtime_error("Archive path contains control characters");
    fs::path path(name);
    for(const auto &part:path) if(part==".."||part==".") throw std::runtime_error("Archive path escapes installation directory");
    return path;
}

fs::path executable() {
    std::array<char,4096> path{};
    auto n=readlink("/proc/self/exe",path.data(),path.size());
    if(n<0||n==static_cast<ssize_t>(path.size())) throw std::runtime_error("Cannot locate installer executable");
    return std::string(path.data(),static_cast<std::size_t>(n));
}

std::uint64_t verifyPayload(std::ifstream &input, const fs::path &self) {
    constexpr std::uint64_t size=KREMEN_PAYLOAD_SIZE;
    const auto total=fs::file_size(self);
    if(size==0 || size>maxPayload || size>=total) throw std::runtime_error("Installer has no valid embedded payload");
    const auto offset=total-size;
    input.seekg(static_cast<std::streamoff>(offset));
    Sha256 hash;
    std::array<char,65536> buffer{};
    auto remaining=size;
    while(remaining) {
        auto count=std::min<std::uint64_t>(remaining,buffer.size());
        input.read(buffer.data(),static_cast<std::streamsize>(count));
        if(!input) throw std::runtime_error("Truncated installer payload");
        hash.update(buffer.data(),count); remaining-=count;
    }
    if(hash.finish()!=KREMEN_PAYLOAD_SHA256) throw std::runtime_error("Payload SHA-256 mismatch. Download the installer again.");
    input.clear(); input.seekg(static_cast<std::streamoff>(offset));
    return size;
}

void extractPayload(std::ifstream &input, const fs::path &stage, std::uint64_t remaining) {
    std::array<char,512> header{};
    std::array<char,65536> buffer{};
    std::size_t entries=0;
    while(remaining>=512) {
        input.read(header.data(),header.size()); remaining-=512;
        if(!input) throw std::runtime_error("Truncated archive header");
        if(std::all_of(header.begin(),header.end(),[](char c){return c==0;})) return;
        if(++entries>30000) throw std::runtime_error("Archive has too many entries");
        auto expected=octal(header.data()+148,8);
        std::uint64_t checksum=0;
        for(std::size_t i=0;i<header.size();++i) checksum+=(i>=148&&i<156)?32:static_cast<unsigned char>(header[i]);
        if(checksum!=expected) throw std::runtime_error("Archive checksum mismatch");
        const auto magic=field(header.data()+257,6);
        if(magic!="ustar") throw std::runtime_error("Only POSIX ustar payloads are supported");
        auto name=field(header.data(),100), prefix=field(header.data()+345,155);
        if(!prefix.empty()) name=prefix+"/"+name;
        auto relative=safeRelative(name);
        auto size=octal(header.data()+124,12);
        auto mode=octal(header.data()+100,8);
        auto type=header[156];
        if(type!='\0'&&type!='0'&&type!='5') throw std::runtime_error("Links and special files are not allowed in installer payloads");
        if(type=='5'&&size) throw std::runtime_error("Archive directory has data");
        if(size>remaining) throw std::runtime_error("Truncated archive file");
        if(relative.empty()) { if(type!='5'||size) throw std::runtime_error("Invalid archive root"); continue; }
        auto destination=stage/relative;
        if(fs::exists(destination)) throw std::runtime_error("Duplicate archive entry");
        if(type=='5') { fs::create_directories(destination); continue; }
        fs::create_directories(destination.parent_path());
        std::ofstream output(destination,std::ios::binary|std::ios::trunc);
        output.exceptions(std::ios::failbit|std::ios::badbit);
        auto bytes=size;
        while(bytes) {
            auto count=std::min<std::uint64_t>(bytes,buffer.size());
            input.read(buffer.data(),static_cast<std::streamsize>(count));
            if(!input) throw std::runtime_error("Truncated archive file data");
            output.write(buffer.data(),static_cast<std::streamsize>(count)); bytes-=count;
        }
        output.close();
        // Ignore setuid/setgid and world-write bits, retaining executable files.
        fs::permissions(destination,static_cast<fs::perms>((mode&0111)?0755:0644));
        auto padded=(size+511)&~std::uint64_t(511);
        if(padded>remaining) throw std::runtime_error("Truncated archive padding");
        input.ignore(static_cast<std::streamsize>(padded-size)); remaining-=padded;
    }
    throw std::runtime_error("Archive has no end marker");
}

bool commandAvailable(const std::string &name) {
    const char *env=std::getenv("PATH");
    std::istringstream paths(env?env:"");
    std::string dir;
    while(std::getline(paths,dir,':')) if(!dir.empty()&&access((fs::path(dir)/name).c_str(),X_OK)==0) return true;
    return false;
}

void dependencies() {
    std::cout << "\nSystem components / Системные компоненты:\n";
    for(const char *name:{"gcc","bwrap"}) std::cout << "  " << name << ": " << (commandAvailable(name)?"found / найден":"MISSING / НЕ НАЙДЕН") << '\n';
    void *webkit=dlopen("libwebkit2gtk-4.1.so.0",RTLD_LAZY|RTLD_LOCAL);
    std::cout << "  WebKitGTK 4.1: " << (webkit?"found / найден":"MISSING / НЕ НАЙДЕН") << '\n';
    if(webkit) dlclose(webkit);
    std::cout << "Missing dependencies can be installed by your system package manager.\n"
        "Недостающие компоненты установите пакетным менеджером вашей ОС.\n"
        "Debian/Ubuntu: gcc libc6-dev bubblewrap libwebkit2gtk-4.1-0 xdg-desktop-portal xdg-desktop-portal-gtk\n"
        "Runtime checks inside Kremen Learn also verify sandbox availability.\n\n";
}

bool contained(const fs::path &child,const fs::path &parent) {
    auto c=child.lexically_normal(), p=parent.lexically_normal();
    auto ci=c.begin();
    for(auto pi=p.begin();pi!=p.end();++pi,++ci) if(ci==c.end()||*ci!=*pi) return false;
    return true;
}

std::string desktopQuote(const fs::path &path) {
    std::string result="\"";
    for(char c:path.string()) {
        if(c=='\\'||c=='"'||c=='`'||c=='$') result+='\\';
        if(c=='%') result+='%';
        result+=c;
    }
    return result+'"';
}

void usage() {
    std::cout << "Kremen Learn " KREMEN_VERSION " — offline installer / офлайн-установщик\n\n"
        "Usage: ./Kremen-Learn-Linux-x86_64.run [--yes] [--prefix ABSOLUTE_PATH]\n"
        "       ./Kremen-Learn-Linux-x86_64.run --check\n"
        "       ./Kremen-Learn-Linux-x86_64.run --verify\n"
        "       ./Kremen-Learn-Linux-x86_64.run --uninstall [--yes] [--prefix PATH]\n\n"
        "Default prefix: ~/.local. No administrator privileges or network needed.\n"
        "Папка по умолчанию: ~/.local. Права администратора и сеть не нужны.\n"
        "Uninstall preserves your projects and progress.\n"
        "Удаление сохраняет ваши проекты и прогресс.\n";
}

int run(int argc,char **argv) {
    bool yes=false,uninstall=false,verify=false,check=false;
    const char *home=std::getenv("HOME");
    if(!home||home[0]!='/') throw std::runtime_error("An absolute HOME directory is required");
    fs::path prefix=fs::path(home)/".local";
    for(int i=1;i<argc;++i) {
        std::string arg=argv[i];
        if(arg=="--help"||arg=="-h") {usage();return 0;}
        if(arg=="--yes"||arg=="-y") yes=true;
        else if(arg=="--uninstall") uninstall=true;
        else if(arg=="--verify") verify=true;
        else if(arg=="--check") check=true;
        else if(arg=="--prefix"&&i+1<argc) prefix=argv[++i];
        else throw std::runtime_error("Unknown or incomplete option: "+arg);
    }
    if(!prefix.is_absolute()||prefix==prefix.root_path()) throw std::runtime_error("Prefix must be an absolute directory other than /");
    for(unsigned char c:prefix.string()) if(c<32||c==127) throw std::runtime_error("Prefix contains control characters");
    prefix=prefix.lexically_normal();
    if(check) {dependencies();return 0;}
    struct utsname machine{};
    if(uname(&machine)!=0||std::string(machine.machine)!="x86_64") throw std::runtime_error("This package requires Linux x86-64");
    std::cout << "\n  KREMEN / LEARN\n  " KREMEN_VERSION " · Offline programming studio\n\n";
    const auto base=prefix/"share/kremen-learn";
    const auto releases=base/"releases";
    const auto launcher=prefix/"bin/kremen-learn";
    const auto desktop=prefix/"share/applications/org.kremen.learn.desktop";
    if(uninstall) {
        if(readText(base/".installer-owned")!=ownership) throw std::runtime_error("No managed installation at this prefix");
        if(!yes) {
            std::cout << "Remove application binaries at " << base << "? [y/N] / Удалить приложение? ";
            std::string answer;std::getline(std::cin,answer);if(answer!="y"&&answer!="Y"&&answer!="yes") return 0;
        }
        if(fs::is_symlink(launcher)&&contained(fs::read_symlink(launcher),releases)) fs::remove(launcher);
        if(readText(desktop).find("X-Kremen-Learn-Managed=true")!=std::string::npos) fs::remove(desktop);
        fs::remove_all(base);
        std::cout << "Application removed. Projects and progress were preserved.\nПриложение удалено. Проекты и прогресс сохранены.\n";
        return 0;
    }
    std::ifstream input(executable(),std::ios::binary);
    auto size=verifyPayload(input,executable());
    std::cout << "Payload SHA-256 verified / SHA-256 проверен.\n";
    if(verify) return 0;
    dependencies();
    std::cout << "Installation / Установка: " << base << '\n';
    if(!yes) {
        std::cout << "Install for this user? [y/N] / Установить для текущего пользователя? ";
        std::string answer;std::getline(std::cin,answer);if(answer!="y"&&answer!="Y"&&answer!="yes") return 0;
    }
    if(fs::exists(base)&&readText(base/".installer-owned")!=ownership) throw std::runtime_error("Installation directory exists and is not managed by this installer");
    if(fs::exists(launcher)&&!fs::is_symlink(launcher)) throw std::runtime_error("Launcher path already contains a regular file; move it before installing");
    if(fs::is_symlink(launcher)&&!contained(fs::read_symlink(launcher),releases)) throw std::runtime_error("Launcher symlink belongs to another application");
    if(fs::exists(desktop)&&readText(desktop).find("X-Kremen-Learn-Managed=true")==std::string::npos) throw std::runtime_error("Desktop entry belongs to another application");
    fs::create_directories(releases);
    fs::permissions(base,fs::perms::owner_all);
    writeText(base/".installer-owned",ownership);
    auto stagePattern=(releases/".stage-XXXXXX").string();
    std::vector<char> templateBuffer(stagePattern.begin(),stagePattern.end());templateBuffer.push_back('\0');
    char *temp=mkdtemp(templateBuffer.data());
    if(!temp) throw std::runtime_error("Cannot create staging directory");
    fs::path stage(temp);
    try {
        extractPayload(input,stage,size);
        if(!fs::is_regular_file(stage/"kremen-learn")||access((stage/"kremen-learn").c_str(),X_OK)!=0)
            throw std::runtime_error("Payload is missing the application executable");
        if(!fs::is_regular_file(stage/"toolchain/bin/kremen")||!fs::is_regular_file(stage/"toolchain/runtime/kremen_rt.h")||!fs::is_regular_file(stage/"content/catalog.json"))
            throw std::runtime_error("Payload is missing the toolchain or curriculum");
        auto release=releases/(std::string(KREMEN_VERSION)+"-"+std::string(KREMEN_PAYLOAD_SHA256).substr(0,12)+"-"+std::to_string(getpid()));
        writeText(stage/".payload-sha256",KREMEN_PAYLOAD_SHA256 "\n");
        fs::rename(stage,release); stage=release;
        fs::create_directories(launcher.parent_path());
        fs::create_directories(desktop.parent_path());
        auto temporaryDesktop=desktop.string()+".tmp-"+std::to_string(getpid());
        auto icon=fs::is_regular_file(release/"icon.png")?(release/"icon.png").string():"applications-development";
        writeText(temporaryDesktop,"[Desktop Entry]\nType=Application\nName=Kremen Learn\nComment=Offline programming studio\nComment[ru]=Офлайн-среда изучения программирования\nExec="+desktopQuote(launcher)+"\nIcon="+icon+"\nTerminal=false\nCategories=Development;Education;\nStartupWMClass=Kremen Learn\nX-Kremen-Learn-Managed=true\n");
        fs::permissions(temporaryDesktop,fs::perms::owner_read|fs::perms::owner_write|fs::perms::group_read|fs::perms::others_read);
        fs::rename(temporaryDesktop,desktop);
        // Change the active release last so a failed update keeps its launcher.
        auto temporaryLink=launcher.string()+".tmp-"+std::to_string(getpid());
        fs::create_symlink(release/"kremen-learn",temporaryLink);
        fs::rename(temporaryLink,launcher);
        std::cout << "\nInstalled / Установлено.\nOpen Kremen Learn from your application menu, or run:\nОткройте Kremen Learn в меню приложений или запустите:\n  " << launcher << '\n';
    } catch(...) {fs::remove_all(stage);throw;}
    return 0;
}
} // namespace

int main(int argc,char **argv) {
    try {return run(argc,argv);}
    catch(const std::exception &error) {std::cerr<<"Installation failed / Ошибка установки: "<<error.what()<<'\n';return 1;}
}
