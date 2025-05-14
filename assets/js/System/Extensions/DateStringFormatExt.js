

class DateStringFormatExt {
	constructor() {
		if(typeof Date.prototype.stringify !=="function") {
			Date.prototype.stringify=function() {
				const year=this.getFullYear();
				const month=String(this.getMonth() + 1).padStart(2, '0');
				const day=String(this.getDate()).padStart(2, '0');
				const hours=this.getHours();
				const minutes=String(this.getMinutes()).padStart(2, '0');
				const seconds=String(this.getSeconds()).padStart(2, '0');
				const ap=hours>=12 ? "PM" : "AM";
				const adjustedHours=String(hours%12 || 12).padStart(2, '0');
				return `${month}-${day}-${year} | ${adjustedHours}:${minutes}:${seconds} ${amPm}`;
			}
		}
	}
}

new DateStringFormatExt();
