import Link from "next/link";
import Image from "next/image";

const Navbar = () => {
  return (
    <header>
      <nav>
        <Link href="/" className="logo">
          <Image src="/icons/logo.png" alt="" width={24} height={24} />
          <p>DevEvent <span className="text-xs text-emerald-300">DEMO</span></p>
        </Link>

        <ul className="list-none">
          <li><Link href="/">Events</Link></li>
          <li><Link href="/organizer">Organizer</Link></li>
        </ul>
      </nav>
    </header>
  );
};

export default Navbar;
