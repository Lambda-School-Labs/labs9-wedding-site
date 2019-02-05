import React from "react";
import Gallery from "react-photo-gallery";
import Lightbox from "react-images";
import styled from "styled-components";
import './designs.css';




const photos = [
	{
		src:
			"https://cdn.freshdesignweb.com/wp-content/uploads/glanz-html-wedding-template.jpg"
	},
	{
		src:
			"https://cdn.freshdesignweb.com/wp-content/uploads/belle-responsive-wedding-template.jpg"
	},
	{
		src:
			"https://cdn.freshdesignweb.com/wp-content/uploads/site/newlyweds-html-wedding-template.jpg"
	}
];

class Design extends React.Component {
	constructor() {
		super();
		this.state = { currentImage: 0 };
		this.closeLightbox = this.closeLightbox.bind(this);
		this.openLightbox = this.openLightbox.bind(this);
		this.gotoNext = this.gotoNext.bind(this);
		this.gotoPrevious = this.gotoPrevious.bind(this);
		this.goToSignUp = this.goToSignUp.bind(this);
	}

	openLightbox = (event) => (obj) => {
		this.setState({
			currentImage: obj.src,
			lightboxIsOpen: true
		});
	}
	closeLightbox() {
		this.setState({
			currentImage: 0,
			lightboxIsOpen: false
		});
	}
	gotoPrevious() {
		this.setState({
			currentImage: this.state.currentImage - 1
		});
	}
	gotoNext() {
		this.setState({
			currentImage: this.state.currentImage + 1
		});
	}
	goToSignUp() {
		let path = "./signup";
		this.props.history.push(path);
	}
	render() {
		return (
			<div id="#designs" className="designs-page">

					<div className="designs-page-hdr ">
						Digital Invitations
					</div>
					<div className="designs-page-info">

					<div className="template-cont">
						<div className="des-template one">
							<img onClick={()=> this.openLightbox()(photos)} className="img-temp1" src="https://cdn.freshdesignweb.com/wp-content/uploads/glanz-html-wedding-template.jpg" alt="invite-template"/>
						</div>
						<div className="des-template two">
							<img onClick={()=> this.openLightbox()(photos)} className="img-temp2" src="https://cdn.freshdesignweb.com/wp-content/uploads/belle-responsive-wedding-template.jpg" alt="invite-template"/>
						</div>
						<div className="des-template three">
							<img onClick={()=> this.openLightbox()(photos)} className="img-temp3" src="https://cdn.freshdesignweb.com/wp-content/uploads/site/newlyweds-html-wedding-template.jpg" alt="invite-template"/>
						</div>
					</div>

					<div className="designs-page-txt">
						<div className="designs-call">
							<span className="">Made perfect for you, by you 
							Choose a template for your site.</span>
						</div>
						<div className="auth-btn">
							Sign Up Now
						</div>
					</div>

					</div>

				
				<Lightbox className="lightboxff"
						images={photos}
						onClose={this.closeLightbox}
						onClickPrev={this.gotoPrevious}
						onClickNext={this.gotoNext}
						currentImage={this.state.currentImage}
						onClickImage={this.goToSignUp}
						isOpen={this.state.lightboxIsOpen}
					/>
			</div>
		);
	}
}
export default Design;

{/* <Gallery
						photos={photos}
						onClick={this.openLightbox}
						style={{ height: 800 }}
					/>
					<Lightbox className="lightboxff"
						images={photos}
						onClose={this.closeLightbox}
						onClickPrev={this.gotoPrevious}
						onClickNext={this.gotoNext}
						currentImage={this.state.currentImage}
						onClickImage={this.goToSignUp}
						isOpen={this.state.lightboxIsOpen}
					/> */}
