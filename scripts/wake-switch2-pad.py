# /// script
# requires-python = ">=3.11"
# dependencies = ["pyusb>=1.2"]
# ///
"""Wake Switch 2 controllers plugged in by USB so the browser sees them.

A Switch 2 pad boots asleep: it only sends input after the console's start-up handshake, sent over
its vendor interface (1). This replays that handshake (sequence from the community procon2tool /
SDL work) on every Switch 2 pad found. The pad stays awake until it is unplugged.
"""
import sys

import usb.core
import usb.util

NINTENDO = 0x057E
PADS = {0x2066: "Joy-Con 2 (L)", 0x2067: "Joy-Con 2 (R)", 0x2069: "Pro Controller 2", 0x2073: "GameCube (Switch 2)"}


def cmd(hexes: str, size: int = 0) -> bytes:
    data = bytes.fromhex(hexes)
    return data + b"\xff" * max(0, size - len(data))


def handshake(player: int) -> list[bytes]:
    leds = [0x01, 0x03, 0x07, 0x0F][min(player, 3)]
    return [
        cmd("03 91 00 0d 00 08 00 00 01 00", 16),
        cmd("07 91 00 01 00 00 00 00"),
        cmd("16 91 00 01 00 00 00 00"),
        cmd("15 91 00 01 00 0e 00 00 00 02", 22),
        cmd("15 91 00 02 00 11 00 00 00", 25),
        cmd("15 91 00 03 00 01 00 00 00"),
        cmd("09 91 00 07 00 08 00 00 00 00 00 00 00 00 00 00"),
        cmd("0c 91 00 02 00 04 00 00 27 00 00 00"),
        cmd("11 91 00 03 00 00 00 00"),
        cmd("0a 91 00 08 00 14 00 00 01 ff ff ff ff ff ff ff ff 35 00 46 00 00 00 00 00 00 00 00"),
        cmd("0c 91 00 04 00 04 00 00 27 00 00 00"),
        cmd("03 91 00 0a 00 04 00 00 09 00 00 00"),
        cmd("10 91 00 01 00 00 00 00"),
        cmd("01 91 00 0c 00 00 00 00"),
        cmd("03 91 00 01 00 00 00"),
        cmd("0a 91 00 02 00 04 00 00 03 00 00"),
        cmd(f"09 91 00 07 00 08 00 00 {leds:02x} 00 00 00 00 00 00 00"),
    ]


def wake(dev, player: int) -> None:
    cfg = dev.get_active_configuration()
    intf = cfg[(1, 0)]
    usb.util.claim_interface(dev, 1)
    try:
        out = usb.util.find_descriptor(intf, custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT)
        inp = usb.util.find_descriptor(intf, custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN)
        for data in handshake(player):
            out.write(data, timeout=1000)
            if inp is not None:
                try:
                    inp.read(64, timeout=200)
                except usb.core.USBError:
                    pass
    finally:
        usb.util.release_interface(dev, 1)
        usb.util.dispose_resources(dev)


def main() -> int:
    found = [d for d in usb.core.find(find_all=True, idVendor=NINTENDO) if d.idProduct in PADS]
    if not found:
        print("No Switch 2 controller found on USB. Plug it in with a data cable.")
        return 1
    failed = 0
    for player, dev in enumerate(found):
        name = PADS[dev.idProduct]
        try:
            wake(dev, player)
            print(f"Woke {name}.")
        except usb.core.USBError as error:
            failed += 1
            print(f"Could not wake {name}: {error}")
    if not failed:
        print("Now press a button on it in the game's tab.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
